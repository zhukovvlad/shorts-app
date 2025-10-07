import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { User } from "@auth/core/types";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/app/lib/db";
import authConfig from "./auth.config";

// Import NextAuth using require to avoid type issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NextAuth = require("next-auth").default;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    async session({ token, session }: { token: JWT; session: Session }) {
      // Safely assign user ID from token.sub
      if (typeof token.sub === "string" && token.sub && session.user) {
        session.user.id = token.sub;
      }

      if (session.user) {
        // Safely assign name with type guard
        if (typeof token.name === "string" && token.name) {
          session.user.name = token.name;
        }

        // Safely assign email with type guard and validation
        if (typeof token.email === "string" && token.email) {
          session.user.email = token.email;
        }

        // Safely assign image/picture with type guard
        if (typeof token.picture === "string" && token.picture) {
          session.user.image = token.picture;
        }
      }

      return session;
    },
    async jwt({ token, user }: { token: JWT; user?: User }) {
      // Only process if we have a valid subject (user ID)
      if (!token.sub) return token;

      // If user object is provided (on sign-in), add additional claims if needed
      if (user) {
        token.id = user.id;
      }

      return token;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  debug: process.env.NODE_ENV === "development",
});
