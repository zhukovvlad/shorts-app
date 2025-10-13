import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
});

/**
 * Manually process credits after successful Stripe checkout.
 * This is a workaround for local development where webhooks don't work.
 * 
 * For production, use webhook handler instead.
 */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await req.json();
        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        // Retrieve the checkout session from Stripe
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

        // Verify the session belongs to this user
        if (checkoutSession.metadata?.userId !== session.user.id) {
            return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
        }

        // Check if payment was successful
        if (checkoutSession.payment_status !== 'paid') {
            return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
        }

        const priceId = checkoutSession.metadata?.priceId;

        // Credit amounts configurable via environment variables
        const creditMap: Record<string, number> = {
            'price_1SA7VoFbnWkjMFsPB9IvRYWg': parseInt(process.env.CREDITS_STARTER || '2'),
            'price_1SA7YQFbnWkjMFsPK7dLbJdu': parseInt(process.env.CREDITS_PRO || '50'),
            'price_1SA7YQFbnWkjMFsPIj2Vct6k': parseInt(process.env.CREDITS_ENTERPRISE || '100')
        };

        const creditsToAdd = creditMap[priceId || ''] || 0;

        if (creditsToAdd === 0) {
            return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
        }

        // Check if credits were already added for this session
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { credits: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Check if this session was already processed to prevent double-crediting
        const existingTransaction = await prisma.creditTransaction.findUnique({
            where: { stripeSessionId: sessionId }
        });

        if (existingTransaction) {
            return NextResponse.json({
                success: true,
                creditsAdded: 0,
                newBalance: user.credits,
                message: "Credits already added for this session"
            });
        }

        // Add credits and record transaction in a single transaction to ensure atomicity
        const updatedUser = await prisma.$transaction(async (tx) => {
            // Add credits
            const user = await tx.user.update({
                where: { id: session.user.id },
                data: {
                    credits: {
                        increment: creditsToAdd
                    }
                }
            });

            // Record the transaction
            await tx.creditTransaction.create({
                data: {
                    stripeSessionId: sessionId,
                    userId: session.user.id,
                    amount: creditsToAdd,
                    type: 'CREDIT'
                }
            });

            return user;
        });

        return NextResponse.json({
            success: true,
            creditsAdded: creditsToAdd,
            newBalance: updatedUser.credits
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to add credits";
        console.error('[add-credits] Error:', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
