import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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
        setError("Не удалось войти. Пожалуйста, попробуйте еще раз.");
      } else if (result?.url) {
        // Use client-side navigation to preserve state and avoid full page reload
        router.push(result.url);
      }
    } catch (err) {
      setError("Произошла ошибка при входе. Пожалуйста, попробуйте позже.");
      console.error("Sign in error:", err);
    } finally {
      setIsLoading(null);
    }
  };

  return { handleSignIn, error, isLoading };
}
