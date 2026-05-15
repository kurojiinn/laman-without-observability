import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных — Yuhher",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Назад */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          На главную
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-10">

          {/* Шапка */}
          <div className="mb-8 pb-6 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
              Юридический документ
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-1">
              Политика обработки<br />персональных данных
            </h1>
            <p className="text-sm text-gray-500 mt-2">сайта Yuhher.ru</p>
            <p className="text-xs text-gray-400 mt-1">Редакция от 16 мая 2026 г.</p>
          </div>

          {/* Содержание */}
          <div className="space-y-8 text-[15px] leading-relaxed text-gray-700">

            {/* 1 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">1. Общие положения</h2>
              <p className="mb-3">
                Настоящая Политика обработки персональных данных (далее — Политика) разработана в соответствии
                с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» (в редакции,
                действующей с 2025 года) и регулирует порядок сбора, хранения, использования и защиты
                персональных данных пользователей сайта Yuhher.ru.
              </p>
              <p>
                Используя сайт Yuhher.ru и его сервисы, вы подтверждаете, что ознакомились с настоящей
                Политикой и даёте согласие на обработку ваших персональных данных на условиях, изложенных ниже.
              </p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">2. Оператор персональных данных</h2>
              <p className="mb-3">Оператором персональных данных является:</p>
              <ul className="space-y-1.5">
                <li><span className="font-medium text-gray-800">ФИО:</span> Амерханов Ибрагим Хизирович</li>
                <li><span className="font-medium text-gray-800">ИНН:</span> 201405728500</li>
                <li><span className="font-medium text-gray-800">Адрес:</span> г. Грозный, Ахматовский район, пер. Эльмурзаева Хасана, офис 41</li>
                <li>
                  <span className="font-medium text-gray-800">Email:</span>{" "}
                  <a href="mailto:yuherExpress@yandex.com" className="text-indigo-600 hover:underline">
                    yuherExpress@yandex.com
                  </a>
                </li>
                <li>
                  <span className="font-medium text-gray-800">Сайт:</span>{" "}
                  <a href="https://Yuhher.ru" className="text-indigo-600 hover:underline">
                    https://Yuhher.ru
                  </a>
                </li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">3. Какие данные мы собираем</h2>
              <p className="mb-4">
                При использовании сайта Yuhher.ru мы можем собирать следующие категории персональных данных:
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">
                    3.1. Данные при регистрации и использовании аккаунта
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>Имя пользователя (никнейм или имя)</li>
                    <li>Адрес электронной почты (email)</li>
                    <li>Номер мобильного телефона</li>
                    <li>Пароль (хранится в хешированном виде)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">
                    3.2. Данные при оформлении заказа
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>Адрес доставки (город, улица, дом, квартира)</li>
                    <li>Контактный номер телефона для связи курьера</li>
                    <li>Имя получателя</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">
                    3.3. Технические данные
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>IP-адрес при обращении к сайту</li>
                    <li>Данные о браузере и устройстве (технические логи)</li>
                  </ul>
                  <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                    Мы не собираем специальные категории персональных данных: сведения о расовой
                    принадлежности, политических взглядах, состоянии здоровья, биометрические данные.
                  </p>
                </div>
              </div>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">4. Цели обработки персональных данных</h2>
              <p className="mb-3">Ваши данные обрабатываются исключительно в следующих целях:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>Регистрация и идентификация пользователя на сайте</li>
                <li>Оформление, подтверждение и доставка заказов</li>
                <li>Связь с пользователем по вопросам заказа (статус, изменения, проблемы)</li>
                <li>Исполнение договора купли-продажи или оказания услуг</li>
                <li>Обработка обращений и претензий пользователей</li>
                <li>Обеспечение безопасности и предотвращение мошенничества</li>
                <li>Соблюдение требований законодательства Российской Федерации</li>
              </ul>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">5. Правовые основания обработки</h2>
              <p className="mb-3">Обработка персональных данных осуществляется на следующих правовых основаниях:</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">—</span>
                  <span>Согласие субъекта персональных данных (ст. 6, ч. 1, п. 1 Закона № 152-ФЗ) — для целей регистрации и использования сервисов сайта</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">—</span>
                  <span>Исполнение договора, стороной которого является пользователь (ст. 6, ч. 1, п. 5 Закона № 152-ФЗ) — для оформления и доставки заказов</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">—</span>
                  <span>Соблюдение обязанностей, возложенных законодательством (ст. 6, ч. 1, п. 2 Закона № 152-ФЗ) — в части налогового и бухгалтерского учёта</span>
                </li>
              </ul>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">6. Сроки хранения персональных данных</h2>
              <p className="mb-3">Персональные данные хранятся в течение следующих сроков:</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">—</span>
                  <span>Данные аккаунта — в течение всего срока существования аккаунта и 3 (три) года после его удаления пользователем</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">—</span>
                  <span>Данные заказов (адрес доставки, телефон, имя получателя) — 5 (пять) лет с момента выполнения заказа в соответствии с требованиями налогового законодательства</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">—</span>
                  <span>Технические логи (IP-адреса) — не более 1 (одного) года</span>
                </li>
              </ul>
              <p className="mt-3 text-sm text-gray-500">
                По истечении указанных сроков данные безвозвратно уничтожаются.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">7. Передача данных третьим лицам</h2>
              <p className="mb-3">
                На текущем этапе работы сайта Yuhher.ru персональные данные пользователей третьим лицам
                не передаются и не продаются.
              </p>
              <p className="mb-3">
                В случае если в будущем будет подключён платёжный сервис (в частности, ЮKassa), данные,
                необходимые для проведения платежа, будут передаваться оператору платёжной системы на
                основании заключённого договора. О подобных изменениях пользователи будут уведомлены
                заблаговременно путём обновления настоящей Политики.
              </p>
              <p>
                Передача данных компетентным государственным органам осуществляется исключительно по
                основаниям и в порядке, установленным законодательством Российской Федерации.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">8. Защита персональных данных</h2>
              <p className="mb-3">
                Оператор принимает необходимые организационные и технические меры для защиты персональных
                данных от несанкционированного доступа, изменения, раскрытия или уничтожения, в том числе:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>Шифрование передачи данных по протоколу HTTPS</li>
                <li>Хранение паролей в хешированном виде</li>
                <li>Ограничение доступа к данным пользователей</li>
                <li>Регулярный контроль систем безопасности</li>
              </ul>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">9. Права пользователей</h2>
              <p className="mb-3">
                В соответствии со статьями 14–17 Федерального закона № 152-ФЗ вы имеете право:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600 mb-3">
                <li>Получить подтверждение факта обработки ваших персональных данных и их перечень</li>
                <li>Потребовать уточнения, обновления или исправления ваших данных</li>
                <li>Отозвать согласие на обработку персональных данных</li>
                <li>Потребовать прекращения обработки и (или) уничтожения данных</li>
                <li>Обжаловать действия оператора в Роскомнадзор или в судебном порядке</li>
              </ul>
              <p className="text-sm text-gray-500">
                Для реализации своих прав направьте обращение на email:{" "}
                <a href="mailto:yuherExpress@yandex.com" className="text-indigo-600 hover:underline">
                  yuherExpress@yandex.com
                </a>. Срок ответа — 10 рабочих дней.
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">10. Cookies и техническая информация</h2>
              <p className="mb-3">
                Сайт Yuhher.ru использует файлы cookies исключительно для технического функционирования:
                хранения сессии авторизованного пользователя и корзины заказов. Сторонние аналитические
                и рекламные сервисы на сайте не подключены.
              </p>
              <p>
                Вы можете отключить cookies в настройках браузера, однако это может нарушить работу
                отдельных функций сайта, в частности авторизацию.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">11. Обновление Политики</h2>
              <p>
                Оператор оставляет за собой право вносить изменения в настоящую Политику. Актуальная версия
                всегда доступна по адресу:{" "}
                <a href="https://Yuhher.ru/privacy-policy" className="text-indigo-600 hover:underline">
                  https://Yuhher.ru/privacy-policy
                </a>.{" "}
                При существенных изменениях пользователи будут уведомлены через сайт или email.
              </p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">12. Контакты</h2>
              <p className="mb-3">По всем вопросам, связанным с обработкой персональных данных:</p>
              <ul className="space-y-1.5">
                <li>
                  <span className="font-medium text-gray-800">Email:</span>{" "}
                  <a href="mailto:yuherExpress@yandex.com" className="text-indigo-600 hover:underline">
                    yuherExpress@yandex.com
                  </a>
                </li>
                <li><span className="font-medium text-gray-800">Оператор:</span> Амерханов Ибрагим Хизирович</li>
                <li><span className="font-medium text-gray-800">Адрес:</span> г. Грозный, Ахматовский район, пер. Эльмурзаева Хасана, офис 41</li>
              </ul>
            </section>

            {/* Дата вступления */}
            <div className="pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-400 text-center">
                Документ вступает в силу с 16 мая 2026 г.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
