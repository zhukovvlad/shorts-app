import { auth } from "@/auth";
import { CREDIT_PLANS } from "@/lib/creditMapping";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
});

// Get base URL with fallback and normalize trailing slashes
const getBaseUrl = () => {
    const trim = (u: string) => u.replace(/\/+$/, "");
    
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return trim(process.env.NEXT_PUBLIC_APP_URL);
    }
    
    if (process.env.VERCEL_URL) {
        return trim(`https://${process.env.VERCEL_URL}`);
    }
    
    // Fallback for development
    return trim('http://localhost:3000');
};

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await req.json();

    // Validate priceId
    if (!priceId || typeof priceId !== "string") {
        return NextResponse.json({ error: "Missing or invalid priceId" }, { status: 400 });
    }

    // Enforce allow-list: only accept known price IDs
    const validPriceIds = CREDIT_PLANS.map(plan => plan.priceId);
    if (!validPriceIds.includes(priceId)) {
        return NextResponse.json({ 
            error: "Invalid priceId", 
            validPriceIds 
        }, { status: 400 });
    }

    const baseUrl = getBaseUrl();

    const stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cancel`,
        metadata: {
            userId: session.user.id,
            priceId: priceId
        }
    })

    return NextResponse.json({url: stripeSession.url});
}