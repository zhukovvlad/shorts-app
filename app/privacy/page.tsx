import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности и обработки персональных данных",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 py-12">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Политика конфиденциальности</CardTitle>
            <CardDescription>
              Последнее обновление: 7 октября 2025 г.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Введение</h2>
              <p className="text-muted-foreground">
                Мы серьезно относимся к защите ваших персональных данных и соблюдаем все применимые 
                законы о защите данных, включая GDPR и российское законодательство о персональных данных. 
                Данная политика описывает, какие данные мы собираем, как мы их используем и защищаем.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Собираемые данные</h2>
              <p className="text-muted-foreground mb-2">
                Мы собираем следующие типы данных:
              </p>
              
              <h3 className="text-lg font-medium mb-2 mt-4">2.1 Данные аутентификации</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Имя и email адрес из вашего OAuth провайдера (Google, Яндекс, Mail.ru, GitHub)</li>
                <li>Уникальный идентификатор пользователя от провайдера</li>
                <li>Аватар профиля (если предоставлен)</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">2.2 Данные использования</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Информация о созданных видео и проектах</li>
                <li>История использования кредитов</li>
                <li>Логи активности и ошибок для улучшения сервиса</li>
                <li>Данные о подписках и платежах</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">2.3 Технические данные</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>IP-адрес</li>
                <li>Тип браузера и устройства</li>
                <li>Cookies и session данные</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Использование данных</h2>
              <p className="text-muted-foreground mb-2">
                Мы используем ваши данные для:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Предоставления и улучшения наших услуг</li>
                <li>Аутентификации и управления вашей учетной записью</li>
                <li>Обработки платежей и управления подписками</li>
                <li>Отправки важных уведомлений о сервисе</li>
                <li>Анализа использования сервиса для его улучшения</li>
                <li>Предотвращения мошенничества и обеспечения безопасности</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Хранение и защита данных</h2>
              <p className="text-muted-foreground">
                Ваши данные хранятся в защищенных базах данных с использованием современных 
                методов шифрования. Мы используем:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                <li>Шифрование данных при передаче (HTTPS/TLS)</li>
                <li>Шифрование паролей и чувствительных данных в базе</li>
                <li>Регулярные резервные копии</li>
                <li>Ограниченный доступ к данным только для авторизованного персонала</li>
                <li>Мониторинг безопасности и обнаружение угроз</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Передача данных третьим лицам</h2>
              <p className="text-muted-foreground mb-2">
                Мы можем передавать ваши данные следующим третьим лицам:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li><strong>OAuth провайдеры</strong> (Google, Яндекс, Mail.ru, GitHub) - для аутентификации</li>
                <li><strong>Stripe</strong> - для обработки платежей (мы не храним данные банковских карт)</li>
                <li><strong>Облачные провайдеры</strong> - для хостинга и хранения данных</li>
                <li><strong>AI провайдеры</strong> - для генерации контента (скрипты, изображения, аудио)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Мы не продаем ваши персональные данные третьим лицам.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Cookies и отслеживание</h2>
              <p className="text-muted-foreground">
                Мы используем cookies для управления сессиями, аутентификации и улучшения 
                пользовательского опыта. Вы можете управлять cookies в настройках вашего браузера, 
                но отключение некоторых cookies может ограничить функциональность сервиса.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Ваши права</h2>
              <p className="text-muted-foreground mb-2">
                В соответствии с законодательством о защите данных, вы имеете право:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Запросить доступ к вашим персональным данным</li>
                <li>Запросить исправление неточных данных</li>
                <li>Запросить удаление ваших данных ("право на забвение")</li>
                <li>Возразить против обработки ваших данных</li>
                <li>Запросить экспорт ваших данных (портативность данных)</li>
                <li>Отозвать согласие на обработку данных</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Для реализации этих прав, пожалуйста, свяжитесь с нами через форму обратной связи.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Хранение данных</h2>
              <p className="text-muted-foreground">
                Мы храним ваши данные до тех пор, пока вы используете наш сервис. 
                После удаления учетной записи, ваши персональные данные будут удалены в течение 
                30 дней, за исключением данных, которые мы обязаны хранить по закону.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Дети</h2>
              <p className="text-muted-foreground">
                Наш сервис не предназначен для лиц младше 16 лет. Мы сознательно не собираем 
                персональные данные детей. Если вы узнали, что ребенок предоставил нам свои данные, 
                пожалуйста, свяжитесь с нами для их удаления.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Изменения в политике</h2>
              <p className="text-muted-foreground">
                Мы можем обновлять эту политику конфиденциальности время от времени. 
                О существенных изменениях мы уведомим вас по электронной почте или через уведомление 
                в сервисе. Дата последнего обновления указана в начале документа.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Контакты</h2>
              <p className="text-muted-foreground">
                Если у вас есть вопросы о нашей политике конфиденциальности или вы хотите 
                воспользоваться своими правами по защите данных, пожалуйста, свяжитесь с нами 
                через форму обратной связи на сайте или по email.
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
