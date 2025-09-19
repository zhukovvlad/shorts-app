"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { LoadingSpinner } from "@/app/components/LoadingSpinner"

const plans = [
  { name: "Starter", price: "$1", features: ["1 video"], priceId: "price_1N7Y2SGa3f3b4vXgYxW8zKJq" },
  { name: "Pro", price: "$20", features: ["25 Videos"], popular: true, priceId: "price_1N7Y2SGa3f3b4vXgYxW8zKJq" },
  { name: "Enterprise", price: "$99", features: ["150 videos"], priceId: "price_1N7Y2SGa3f3b4vXgYxW8zKJq" },
]

export default function PricingClient() {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)

  const handleSubscription = async (priceId: string) => {
    try {
      setLoadingPriceId(priceId)
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => "")
        throw new Error(errorText || `Checkout failed (${res.status})`)
      }

      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
        return
      }
      throw new Error("No checkout URL returned")
    } catch (err: any) {
      toast.error("Unable to start checkout", {
        description: err?.message ?? "Please try again in a moment.",
      })
    } finally {
      setLoadingPriceId(null)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h1>
        <p className="text-xl text-muted-foreground mb-12">Choose the plan that fits your needs</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-lg p-6 border bg-card text-card-foreground transition-colors ${
                plan.popular ? "ring-2 ring-blue-500" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform bg-gradient-to-br text-white from-[#3352CC] to-[#1C2D70] px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <div className="my-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">/one-time</span>
              </div>

              <ul className="space-y-3 mb-8 text-foreground/90">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <span className="text-blue-500 mr-3" aria-hidden="true">✔</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                onClick={() => handleSubscription(plan.priceId)}
                disabled={loadingPriceId === plan.priceId}
                aria-busy={loadingPriceId === plan.priceId}
                className={`w-full ${
                  plan.popular
                    ? "bg-gradient-to-br hover:opacity-80 text-white rounded-full from-[#3352CC] to-[#1C2D70] font-medium cursor-pointer"
                    : "bg-gray-800 hover:bg-gray-900 text-white cursor-pointer dark:bg-white/10 dark:hover:bg-white/15"
                } disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                {loadingPriceId === plan.priceId ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" className="border-white" />
                    Processing...
                  </span>
                ) : plan.popular ? (
                  "Sign up"
                ) : (
                  "Get started"
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
