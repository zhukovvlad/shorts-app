"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const SuccessPage = () => {
    const searchParams = useSearchParams();
    const [isProcessing, setIsProcessing] = useState(true);
    const [creditsAdded, setCreditsAdded] = useState<number | null>(null);

    useEffect(() => {
        const sessionId = searchParams.get("session_id");
        
        if (!sessionId) {
            setIsProcessing(false);
            return;
        }

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
                    setCreditsAdded(data.creditsAdded);
                    toast.success(`${data.creditsAdded} credits added to your account!`);
                } else {
                    console.error("Failed to add credits:", data.error);
                    toast.error("Credits will be added shortly via webhook");
                }
            } catch (error) {
                console.error("Error adding credits:", error);
                toast.error("Credits will be added shortly");
            } finally {
                setIsProcessing(false);
            }
        };

        addCredits();
    }, [searchParams]);

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
                        {isProcessing ? "Processing payment..." : "Payment successful!"}
                    </h1>
                    <p className="text-gray-300 text-base">
                        {isProcessing 
                            ? "Please wait while we add credits to your account..."
                            : creditsAdded 
                                ? `${creditsAdded} credits have been added to your account.`
                                : "Credits were successfully added to your account."
                        }
                        {" "}You can continue with your video creation.
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

export default SuccessPage;