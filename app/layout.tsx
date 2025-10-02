import React from "react";
import type { Metadata } from "next";
import {
  ClerkProvider,
} from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import NavigationWrapper from "@/components/NavigationWrapper";

export const metadata: Metadata = {
  title: "ShortsApp - Create Viral Videos with AI",
  description: "Transform any idea into engaging short videos in minutes using AI. Perfect for TikTok, YouTube Shorts, and Instagram Reels. No editing skills required.",
  keywords: "AI video generator, short videos, TikTok content, YouTube Shorts, Instagram Reels, viral videos, video creation, artificial intelligence",
  authors: [{ name: "ShortsApp Team" }],
  creator: "ShortsApp",
  publisher: "ShortsApp",
  openGraph: {
    title: "ShortsApp - Create Viral Videos with AI",
    description: "Transform any idea into engaging short videos in minutes using AI. Perfect for TikTok, YouTube Shorts, and Instagram Reels.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000",
    siteName: "ShortsApp",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShortsApp - Create Viral Videos with AI",
    description: "Transform any idea into engaging short videos in minutes using AI.",
    creator: "@shortsapp",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="font-sans antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <header>
              <NavigationWrapper />
            </header>
            {children}
            <Toaster theme="dark" position="top-right" richColors />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
