import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AUTH_ERRORS } from "@/app/constants/errors";

/**
 * Custom hook for OAuth sign-in functionality.
 * Handles sign-in flow, loading states, and error handling for OAuth providers.
 * 
 * @returns {Object} Object containing:
 *   - handleSignIn: Function to initiate OAuth sign-in
 *   - error: Current error message or null
 *   - isLoading: Currently loading provider or null
 */
export function useOAuthSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async (provider: string) => {
    try {
      // Clear any previous errors
      setError(null);
      setIsLoading(provider);

      const result = await signIn(provider, { 
        callbackUrl: "/dashboard",
        redirect: false 
      });

      if (result?.error) {
        setError(AUTH_ERRORS.SIGN_IN_FAILED);
      } else if (result?.url) {
        // Use client-side navigation to preserve state and avoid full page reload
        router.push(result.url);
      } else if (result) {
        // Unexpected: no error and no url
        console.warn("Sign in returned unexpected result:", result);
        setError(AUTH_ERRORS.UNEXPECTED_RESULT);
      }
    } catch (err) {
      setError(AUTH_ERRORS.GENERIC_ERROR);
      console.error("Sign in error:", err);
    } finally {
      setIsLoading(null);
    }
  };

  return { handleSignIn, error, isLoading };
}
