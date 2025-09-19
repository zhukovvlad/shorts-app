import type { Metadata } from "next"
import PricingClient from "./PricingClient"

export const metadata: Metadata = {
  title: "Pricing | Shorts App",
  description: "Simple, transparent pricing for Shorts App. Choose the plan that fits your needs and start creating videos in minutes.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing | Shorts App",
    description:
      "Simple, transparent pricing for Shorts App. Choose the plan that fits your needs and start creating videos in minutes.",
    url: "/pricing",
    type: "website",
  },
}

export default function PricingPage() {
  return <PricingClient />
}