import { prisma } from "@/app/lib/db";
import { getCreditsForPriceId } from "@/lib/creditMapping";
import Stripe from "stripe";

// Import enum from generated Prisma client
import { CreditTransactionType } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
});

export async function POST(req: Request) {
    const body = await req.text();
    const signature = req.headers.get("Stripe-Signature") as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

    if (!webhookSecret) {
        return new Response("Webhook secret not configured", { status: 500 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid signature";
        return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;
        const userId = session.metadata?.userId ?? null;
        const priceId = session.metadata?.priceId ?? null;

        // Get credit amount using shared helper (keeps amounts in sync with /api/stripe/add-credits)
        const creditsToAdd = getCreditsForPriceId(priceId);

        if (!userId || !sessionId || creditsToAdd <= 0) {
            return new Response('Ok', { status: 200 });
        }

        // Idempotency: skip if already processed (prevents double-crediting on Stripe retries)
        const existing = await prisma.creditTransaction.findUnique({
            where: { stripeSessionId: sessionId },
        });
        if (existing) {
            return new Response('Ok', { status: 200 });
        }

        // Atomic operation: add credits + record transaction
        try {
            await prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: userId },
                    data: { credits: { increment: creditsToAdd } },
                });
                await tx.creditTransaction.create({
                    data: {
                        stripeSessionId: sessionId,
                        userId,
                        amount: creditsToAdd,
                        type: CreditTransactionType.CREDIT,
                    },
                });
            });
        } catch (transactionError: any) {
            // Handle race condition: concurrent webhook processing
            // (Prisma P2002 = unique constraint violation on stripeSessionId)
            if (transactionError.code === 'P2002') {
                // Transaction already processed by concurrent webhook - this is OK
                return new Response('Ok', { status: 200 });
            }

            // Log and return error for other transaction failures
            console.error('[webhook] Transaction error:', transactionError);
            return new Response('Transaction failed', { status: 500 });
        }
    }

    return new Response('Ok', { status: 200 })
}