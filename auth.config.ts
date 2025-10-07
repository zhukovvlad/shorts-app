import type { AuthConfig } from "@auth/core/types";
import type { Provider } from "next-auth/providers";
import Yandex from "next-auth/providers/yandex";
import MailRu from "next-auth/providers/mailru";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

/**
 * OAuth Provider configuration with runtime validation.
 * 
 * This config validates environment variables at startup and only enables
 * providers that have both clientId and clientSecret configured.
 * 
 * Required environment variables (at least one provider must be configured):
 * - GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
 * - GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET
 * - YANDEX_CLIENT_ID + YANDEX_CLIENT_SECRET
 * - MAILRU_CLIENT_ID + MAILRU_CLIENT_SECRET
 */

// Define provider configurations with their required env vars
const providerConfigs = [
  {
    name: "Google",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    factory: (clientId: string, clientSecret: string) =>
      Google({ clientId, clientSecret }),
  },
  {
    name: "GitHub",
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    factory: (clientId: string, clientSecret: string) =>
      GitHub({ clientId, clientSecret }),
  },
  {
    name: "Yandex",
    clientId: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET,
    factory: (clientId: string, clientSecret: string) =>
      Yandex({ clientId, clientSecret }),
  },
  {
    name: "Mail.ru",
    clientId: process.env.MAILRU_CLIENT_ID,
    clientSecret: process.env.MAILRU_CLIENT_SECRET,
    factory: (clientId: string, clientSecret: string) =>
      MailRu({ clientId, clientSecret }),
  },
];

// Build providers array conditionally based on available env vars
const providers: Provider[] = [];
const missingProviders: string[] = [];
const enabledProviders: string[] = [];

for (const config of providerConfigs) {
  if (config.clientId && config.clientSecret) {
    providers.push(config.factory(config.clientId, config.clientSecret));
    enabledProviders.push(config.name);
  } else {
    missingProviders.push(config.name);
    
    // Log which env vars are missing for this provider
    const missingVars: string[] = [];
    if (!config.clientId) {
      missingVars.push(`${config.name.toUpperCase().replace(/\./g, "")}_CLIENT_ID`);
    }
    if (!config.clientSecret) {
      missingVars.push(`${config.name.toUpperCase().replace(/\./g, "")}_CLIENT_SECRET`);
    }
    
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[auth.config] ${config.name} provider disabled. Missing: ${missingVars.join(", ")}`
      );
    }
  }
}

// Ensure at least one provider is configured
if (providers.length === 0) {
  const errorMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ NextAuth Configuration Error: No OAuth providers configured!

At least one OAuth provider must be configured with valid credentials.

Missing providers: ${missingProviders.join(", ")}

Required environment variables (at least one pair):
  • GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
  • GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET
  • YANDEX_CLIENT_ID + YANDEX_CLIENT_SECRET
  • MAILRU_CLIENT_ID + MAILRU_CLIENT_SECRET

Please add the required environment variables to your .env file.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
  
  throw new Error(errorMessage);
}

// Log enabled providers in development
if (process.env.NODE_ENV === "development") {
  console.log(`[auth.config] Enabled OAuth providers: ${enabledProviders.join(", ")}`);
}

// Export the configuration
export default {
  providers,
} satisfies AuthConfig;
