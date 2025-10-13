"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const SuccessContent = () => {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session_id");
    const [isProcessing, setIsProcessing] = useState(true);
    const [creditsAdded, setCreditsAdded] = useState<number | null>(null);
    const [isPendingWebhook, setIsPendingWebhook] = useState(false);
    const [alreadyProcessed, setAlreadyProcessed] = useState(false);
    // Track processed sessionIds (allows different sessionIds in same tab)
    const processedSessions = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!sessionId) {
            setIsProcessing(false);
            return;
        }

        // Prevent duplicate calls for the same sessionId (React StrictMode protection)
        if (processedSessions.current.has(sessionId)) {
            return;
        }

        processedSessions.current.add(sessionId);

        // Call API to add credits
        const addCredits = async () => {
            try {
                const response = await fetch("/api/stripe/add-credits", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Credits successfully added
                    setCreditsAdded(data.creditsAdded);
                    
                    // Check if credits were actually added or already processed
                    if (data.creditsAdded > 0) {
                        toast.success(`${data.creditsAdded} credits added to your account!`);
                    } else {
                        // Already processed (idempotency or webhook beat us)
                        setAlreadyProcessed(true);
                        toast.info("Payment confirmed! Credits already added.");
                    }
                } else {
                    // API failed - webhook will handle it
                    console.error("Failed to add credits:", data.error);
                    setIsPendingWebhook(true);
                    setCreditsAdded(null);
                    toast.info("Payment confirmed! Credits will be added via webhook shortly.");
                }
            } catch (error) {
                // Network error - webhook will handle it
                console.error("Error adding credits:", error);
                setIsPendingWebhook(true);
                setCreditsAdded(null);
                toast.info("Payment confirmed! Credits will be added shortly.");
            } finally {
                setIsProcessing(false);
            }
        };

        addCredits();
    }, [sessionId]);

    return (
        <main className="min-h-screen bg-black flex items-center justify-center p-4">
            <article className="text-center space-y-8 max-w-md">
                <div className="flex justify-center">
                    <CheckCircle
                        className="h-16 w-16 text-green-500 drop-shadow-lg"
                        aria-hidden="true"
                    />
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-bold text-white">
                        {isProcessing ? "Processing payment..." : sessionId ? "Payment successful!" : "No checkout session found"}
                    </h1>
                    <p className="text-gray-300 text-base">
                        {isProcessing 
                            ? "Please wait while we add credits to your account..."
                            : alreadyProcessed
                                ? "Credits already added to your account."
                                : isPendingWebhook
                                    ? "Your payment was successful. Credits will be added to your account within a few moments via our webhook system."
                                    : creditsAdded && creditsAdded > 0
                                        ? `${creditsAdded} credits have been added to your account.`
                                        : sessionId
                                            ? "Credits have been successfully added to your account."
                                            : "We could not find a Stripe checkout session. If you completed a payment, please open the link from your email or return to the dashboard."
                        }
                        {" "}
                        {!isProcessing && sessionId && "You can continue with your video creation."}
                    </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                    <Link href="/dashboard">
                        <Button 
                            disabled={isProcessing}
                            className="bg-gradient-to-br hover:opacity-90 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium flex items-center gap-2 justify-center w-48 py-3 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3352CC] focus-visible:ring-offset-black cursor-pointer disabled:opacity-50"
                        >
                            Go to Dashboard
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </Link>

                    <Link
                        href="/"
                        className="text-gray-300 hover:text-white underline-offset-4 hover:underline"
                    >
                        Back to Home
                    </Link>
                </div>
            </article>
        </main>
    );
};

const SuccessPage = () => {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
            <SuccessContent />
        </Suspense>
    );
};

export default SuccessPage;