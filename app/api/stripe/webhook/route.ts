import { prisma } from "@/app/lib/db";
import Stripe from "stripe";

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
    } catch (err: any) {
        return new Response(`Webhook Error: ${err.message ?? "Invalid signature"}`, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const priceId = session.metadata?.priceId

        const creditMap: Record<string, number> = {
            'price_1SA7VoFbnWkjMFsPB9IvRYWg': 2,
            'price_1SA7YQFbnWkjMFsPK7dLbJdu': 50,
            'price_1SA7YQFbnWkjMFsPIj2Vct6k': 100
        }

        const creditsToAdd = creditMap[priceId || ''] || 0;

        if (userId && creditsToAdd > 0) {
            await prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    credits: {
                        increment: creditsToAdd
                    }
                }
            })
        }
    }

    return new Response('Ok', { status: 200 })
}