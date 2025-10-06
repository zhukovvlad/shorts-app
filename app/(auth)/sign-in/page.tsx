"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chrome, Github, Mail } from "lucide-react";

export default function SignInPage() {
  const handleSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">Добро пожаловать</CardTitle>
          <CardDescription>
            Войдите в аккаунт, чтобы создавать вирусные видео с помощью AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("google")}
          >
            <Chrome className="mr-2 h-5 w-5" />
            Войти через Google
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("yandex")}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm4.576 17.885h-2.078l-3.23-7.605h-.054v7.605H9.346V6.115h2.63c2.192 0 3.542 1.256 3.542 3.021 0 1.554-.87 2.538-2.23 2.889l2.288 5.86zm-3.868-9.582c0-1.024-.696-1.597-1.8-1.597h-.562v3.27h.562c1.104 0 1.8-.573 1.8-1.673z"/>
            </svg>
            Войти через Яндекс
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("mailru")}
          >
            <Mail className="mr-2 h-5 w-5" />
            Войти через Mail.ru
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => handleSignIn("github")}
          >
            <Github className="mr-2 h-5 w-5" />
            Войти через GitHub
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Безопасная авторизация
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Продолжая, вы соглашаетесь с нашими{" "}
            <a href="/terms" className="underline underline-offset-4 hover:text-primary">
              условиями использования
            </a>{" "}
            и{" "}
            <a href="/privacy" className="underline underline-offset-4 hover:text-primary">
              политикой конфиденциальности
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
