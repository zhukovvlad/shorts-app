import { auth } from "@/auth";
import { CREDIT_PLANS } from "@/lib/creditMapping";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
});

/**
 * Get base URL with validation, normalization and protocol enforcement
 * @param env - Environment variables object (defaults to process.env for testability)
 * @returns Normalized absolute URL without trailing slash
 * @throws Error if URL is invalid or missing
 */
export const getBaseUrl = (env: NodeJS.ProcessEnv = process.env): string => {
    // Helper to trim whitespace and trailing slashes
    const normalize = (url: string): string => {
        return url.trim().replace(/\/+$/, "");
    };

    // Get candidate URL from environment
    let candidateUrl: string;

    if (env.NEXT_PUBLIC_APP_URL) {
        candidateUrl = normalize(env.NEXT_PUBLIC_APP_URL);
        
        // Check if it already has a protocol
        const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidateUrl);
        
        if (hasProtocol) {
            // Validate it's http or https BEFORE creating URL
            if (!/^https?:\/\//i.test(candidateUrl)) {
                const match = candidateUrl.match(/^([a-z][a-z0-9+.-]*):\/\//i);
                const protocol = match ? match[1] : 'unknown';
                throw new Error(
                    `Invalid protocol: ${protocol}:. Only http and https are allowed. ` +
                    `Please set NEXT_PUBLIC_APP_URL to use http:// or https://`
                );
            }
        } else {
            // No protocol - add one based on environment
            const isProduction = env.NODE_ENV === 'production' || env.VERCEL_URL !== undefined;
            candidateUrl = `${isProduction ? 'https' : 'http'}://${candidateUrl}`;
        }
    } else if (env.VERCEL_URL) {
        candidateUrl = normalize(env.VERCEL_URL);
        // Vercel URLs never have protocol, always add https
        candidateUrl = `https://${candidateUrl}`;
    } else {
        // Fallback for development
        candidateUrl = 'http://localhost:3000';
    }

    // Validate URL by constructing URL object
    try {
        const urlObj = new URL(candidateUrl);
        
        // Double-check protocol (should already be validated above)
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            throw new Error(`Invalid protocol: ${urlObj.protocol}`);
        }

        // Return normalized URL without trailing slash
        return normalize(urlObj.toString());
    } catch (error) {
        // If the error is from our protocol check, re-throw it
        if (error instanceof Error && error.message.startsWith('Invalid protocol:')) {
            throw error;
        }
        
        // Otherwise it's a URL parsing error
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
            `Invalid base URL configuration: "${candidateUrl}". ` +
            `Please set NEXT_PUBLIC_APP_URL to a valid absolute URL (e.g., https://example.com). ` +
            `Error: ${message}`
        );
    }
};

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate JSON body
    let priceId: unknown;
    try {
        ({ priceId } = await req.json());
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate priceId
    if (!priceId || typeof priceId !== "string") {
        return NextResponse.json({ error: "Missing or invalid priceId" }, { status: 400 });
    }

    // Enforce allow-list: only accept known price IDs
    const validPriceIds = CREDIT_PLANS.map(plan => plan.priceId);
    if (!validPriceIds.includes(priceId)) {
        const payload: any = { error: "Invalid priceId" };
        // Only expose valid price IDs in non-production environments
        if (process.env.NODE_ENV !== 'production') {
            payload.validPriceIds = validPriceIds;
        }
        return NextResponse.json(payload, { status: 400 });
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