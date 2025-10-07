import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import authConfig from "@/auth.config";

// Import NextAuth for Edge Runtime
// Dynamic import to ensure Edge Runtime compatibility without Prisma adapter
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NextAuth = require("next-auth").default;

// Create Edge-safe auth instance
// JWT strategy only - no Prisma adapter, no Node-only modules for Edge Runtime compatibility
export const { auth } = NextAuth({
  session: { strategy: "jwt" },
  ...authConfig,
});

// Middleware function with proper Edge Runtime typing
export default auth(async function middleware(req: NextRequest & { auth: any }) {
  const isLoggedIn = !!req.auth;
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard") || 
                          req.nextUrl.pathname.startsWith("/new") ||
                          req.nextUrl.pathname.startsWith("/videos");

  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}