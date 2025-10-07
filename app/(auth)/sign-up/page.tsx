"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chrome, Github, Mail, AlertCircle } from "lucide-react";
import { useOAuthSignIn } from "@/app/hooks/useOAuthSignIn";

/**
 * Sign-up page for new users.
 * 
 * Note: This application uses OAuth-based authentication only (Google, Yandex, Mail.ru, GitHub).
 * User accounts are automatically created on first sign-in via OAuth providers.
 * We do not support traditional email/password registration to simplify security and user experience.
 * 
 * If credential-based registration is needed in the future, implement:
 * 1. A form with email, password, confirm password fields
 * 2. Client-side validation (password strength, email format)
 * 3. API route POST /api/auth/register that:
 *    - Validates input
 *    - Checks for existing users
 *    - Hashes password with bcrypt
 *    - Creates user in database
 *    - Returns success/error
 * 4. Auto sign-in after successful registration
 */
export default function SignUpPage() {
  const { handleSignIn, error, isLoading } = useOAuthSignIn();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">Создать аккаунт</CardTitle>
          <CardDescription>
            Выберите удобный способ для регистрации и начните создавать вирусные видео с AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("google")}
            disabled={isLoading !== null}
          >
            <Chrome className="mr-2 h-5 w-5" />
            {isLoading === "google" ? "Регистрация..." : "Продолжить с Google"}
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("yandex")}
            disabled={isLoading !== null}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm4.576 17.885h-2.078l-3.23-7.605h-.054v7.605H9.346V6.115h2.63c2.192 0 3.542 1.256 3.542 3.021 0 1.554-.87 2.538-2.23 2.889l2.288 5.86zm-3.868-9.582c0-1.024-.696-1.597-1.8-1.597h-.562v3.27h.562c1.104 0 1.8-.573 1.8-1.673z"/>
            </svg>
            {isLoading === "yandex" ? "Регистрация..." : "Продолжить с Яндекс"}
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("mailru")}
            disabled={isLoading !== null}
          >
            <Mail className="mr-2 h-5 w-5" />
            {isLoading === "mailru" ? "Регистрация..." : "Продолжить с Mail.ru"}
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("github")}
            disabled={isLoading !== null}
          >
            <Github className="mr-2 h-5 w-5" />
            {isLoading === "github" ? "Регистрация..." : "Продолжить с GitHub"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Быстрая и безопасная регистрация
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Как это работает:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Аккаунт создается автоматически при первом входе</li>
              <li>Не нужно придумывать и запоминать пароль</li>
              <li>Используется безопасная OAuth авторизация</li>
            </ul>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Продолжая, вы соглашаетесь с нашими{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              условиями использования
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
              политикой конфиденциальности
            </Link>
          </p>

          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <Link href="/sign-in" className="font-medium text-primary underline underline-offset-4 hover:text-primary/80">
                Войти
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
