import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { getCreditsForPriceId } from "@/lib/creditMapping";
import { CreditTransactionType, Prisma } from "@prisma/client";
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

        let sessionId: unknown;
        try {
            ({ sessionId } = await req.json());
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        if (typeof sessionId !== 'string' || !sessionId.trim()) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }
        // Trim whitespace after validation
        const trimmedSessionId = sessionId.trim();

        // Retrieve the checkout session from Stripe with line_items expanded
        // This allows us to verify priceId from server-trusted data (line_items)
        // rather than relying solely on client-provided metadata
        const checkoutSession = await stripe.checkout.sessions.retrieve(trimmedSessionId, {
            expand: ['line_items', 'line_items.data.price'],
        });

        // Verify the session belongs to this user
        if (checkoutSession.metadata?.userId !== session.user.id) {
            return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
        }

        // Check if payment was successful
        if (checkoutSession.payment_status !== 'paid') {
            return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
        }

        // Prefer server-trusted priceId from line_items, fallback to metadata if needed
        // This hardens against potential metadata tampering
        const linePriceId = checkoutSession?.line_items?.data?.[0]?.price?.id as string | undefined;
        const priceId = linePriceId ?? checkoutSession.metadata?.priceId;

        // Get credit amount using shared helper (keeps amounts in sync with webhook)
        const creditsToAdd = getCreditsForPriceId(priceId);

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
            where: { stripeSessionId: trimmedSessionId }
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
        try {
            const updatedUser = await prisma.$transaction(async (tx) => {
                // Add credits
                const updatedUser = await tx.user.update({
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
                        stripeSessionId: trimmedSessionId,
                        userId: session.user.id,
                        amount: creditsToAdd,
                        type: CreditTransactionType.CREDIT
                    }
                });

                return updatedUser;
            });

            return NextResponse.json({
                success: true,
                creditsAdded: creditsToAdd,
                newBalance: updatedUser.credits
            });
        } catch (transactionError: unknown) {
            // Type-safe error narrowing for Prisma errors
            const isKnownError = transactionError instanceof Prisma.PrismaClientKnownRequestError;
            
            // Handle race condition: if another concurrent request already created the transaction
            // (Prisma P2002 = unique constraint violation on stripeSessionId)
            if (isKnownError && transactionError.code === 'P2002') {
                // Transaction was already processed by concurrent request - fetch current user state
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { credits: true }
                });

                return NextResponse.json({
                    success: true,
                    creditsAdded: 0,
                    newBalance: currentUser?.credits ?? user.credits,
                    message: "Credits already added for this session (concurrent request)"
                });
            }

            // Re-throw other transaction errors
            throw transactionError;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to add credits";
        console.error('[add-credits] Error:', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
