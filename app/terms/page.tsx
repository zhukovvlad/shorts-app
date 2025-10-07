import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Условия использования",
  description: "Условия использования сервиса создания видео с помощью AI",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 py-12">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Условия использования</CardTitle>
            <CardDescription>
              Последнее обновление: 7 октября 2025 г.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Принятие условий</h2>
              <p className="text-muted-foreground">
                Используя наш сервис для создания видео с помощью искусственного интеллекта, 
                вы соглашаетесь с данными условиями использования. Если вы не согласны с какими-либо 
                из этих условий, пожалуйста, не используйте наш сервис.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Описание сервиса</h2>
              <p className="text-muted-foreground">
                Наш сервис предоставляет инструменты для создания коротких видео с использованием 
                технологий искусственного интеллекта. Мы предлагаем различные тарифные планы, 
                включая бесплатный и премиум-доступ с дополнительными возможностями.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Учетная запись пользователя</h2>
              <p className="text-muted-foreground mb-2">
                Для использования сервиса вы должны создать учетную запись через один из 
                поддерживаемых методов аутентификации (Google, Яндекс, Mail.ru, GitHub). 
                Вы несете ответственность за:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Сохранение конфиденциальности вашей учетной записи</li>
                <li>Все действия, совершенные под вашей учетной записью</li>
                <li>Немедленное уведомление нас о любом несанкционированном использовании</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Использование сервиса</h2>
              <p className="text-muted-foreground mb-2">
                Вы обязуетесь использовать сервис только в законных целях. Запрещается:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Создавать контент, нарушающий законы или права третьих лиц</li>
                <li>Распространять вредоносное ПО или осуществлять кибератаки</li>
                <li>Пытаться получить несанкционированный доступ к системе</li>
                <li>Использовать сервис для спама или мошенничества</li>
                <li>Создавать контент, содержащий насилие, дискриминацию или hate speech</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Интеллектуальная собственность</h2>
              <p className="text-muted-foreground">
                Контент, созданный вами с помощью нашего сервиса, принадлежит вам. 
                Однако вы предоставляете нам лицензию на использование этого контента 
                для улучшения и демонстрации возможностей сервиса. Весь остальной контент 
                сервиса (интерфейс, логотипы, код) является нашей собственностью.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Оплата и возвраты</h2>
              <p className="text-muted-foreground">
                Платные подписки оплачиваются через платежную систему Stripe. 
                Отмена подписки происходит мгновенно, но возврат средств за неиспользованный 
                период не предусмотрен, если иное не требуется законодательством.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Ограничение ответственности</h2>
              <p className="text-muted-foreground">
                Сервис предоставляется "как есть" без каких-либо гарантий. Мы не несем 
                ответственности за любые прямые или косвенные убытки, возникшие в результате 
                использования или невозможности использования сервиса.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Изменения условий</h2>
              <p className="text-muted-foreground">
                Мы оставляем за собой право изменять данные условия использования в любое время. 
                Об изменениях будет сообщено через сервис или по электронной почте. 
                Продолжение использования сервиса после изменений означает ваше согласие с новыми условиями.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Контактная информация</h2>
              <p className="text-muted-foreground">
                Если у вас есть вопросы по данным условиям использования, пожалуйста, свяжитесь с нами 
                через форму обратной связи на сайте.
              </p>
            </section>

            <div className="flex gap-4 pt-6 border-t">
              <Button asChild variant="outline">
                <Link href="/sign-in">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Вернуться к входу
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">
                  Перейти в Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
