import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных — Yuhher",
};

export default function ConsentPage() {
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
              Согласие на обработку<br />персональных данных
            </h1>
            <p className="text-sm text-gray-500 mt-2">для форм на сайте Yuhher.ru</p>
            <p className="text-xs text-gray-400 mt-1">
              Редакция от 16 мая 2026 г. · Соответствует требованиям с 01.09.2025
            </p>
          </div>

          {/* Вводный абзац */}
          <div className="space-y-8 text-[15px] leading-relaxed text-gray-700">

            <p>
              Я, пользователь сайта Yuhher.ru (далее — Субъект), в соответствии со статьёй 9
              Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных», свободно, своей
              волей и в своём интересе даю согласие:
            </p>

            {/* Оператор */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Оператор</h2>
              <p>
                Амерханов Ибрагим Хизирович, ИНН 201405728500, адрес: г. Грозный, Ахматовский район,
                пер. Эльмурзаева Хасана, офис 41, email:{" "}
                <a href="mailto:yuherExpress@yandex.com" className="text-indigo-600 hover:underline">
                  yuherExpress@yandex.com
                </a>.
              </p>
            </section>

            {/* Перечень */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Перечень персональных данных</h2>
              <p className="mb-3">Согласие распространяется на следующие персональные данные:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>Имя (при регистрации и оформлении заказа)</li>
                <li>Адрес электронной почты (email)</li>
                <li>Номер мобильного телефона</li>
                <li>Адрес доставки (при оформлении заказа)</li>
              </ul>
            </section>

            {/* Цели */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Цели обработки</h2>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>Регистрация на сайте и создание личного кабинета</li>
                <li>Оформление, подтверждение и доставка заказов</li>
                <li>Информирование о статусе заказа</li>
                <li>Обработка обращений и обратной связи</li>
              </ul>
            </section>

            {/* Действия */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Действия с персональными данными</h2>
              <p className="text-gray-600">
                Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение),
                извлечение, использование, блокирование, удаление, уничтожение персональных данных.
              </p>
            </section>

            {/* Срок действия */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Срок действия согласия</h2>
              <p>
                Согласие действует с момента его предоставления до момента отзыва. Согласие может быть
                отозвано в любое время путём направления письменного заявления на email:{" "}
                <a href="mailto:yuherExpress@yandex.com" className="text-indigo-600 hover:underline">
                  yuherExpress@yandex.com
                </a>.{" "}
                После отзыва согласия оператор прекращает обработку данных в течение 30 (тридцати) дней,
                за исключением случаев, когда обработка необходима для исполнения договора или по
                требованию закона.
              </p>
            </section>

            {/* Срок хранения */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Срок хранения данных</h2>
              <p>
                Данные аккаунта хранятся в течение всего срока его существования и 3 года после удаления.
                Данные заказов — 5 лет. По истечении сроков данные уничтожаются.
              </p>
            </section>

            {/* Передача */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Передача третьим лицам</h2>
              <p>
                На текущем этапе персональные данные третьим лицам не передаются. При подключении
                платёжных сервисов (ЮKassa и др.) данные будут передаваться оператору платёжной системы
                в объёме, необходимом для проведения платежа.
              </p>
            </section>

            {/* Права */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">Права Субъекта</h2>
              <p>
                Субъект вправе в любое время отозвать настоящее согласие, запросить доступ к своим
                данным, потребовать их исправления или удаления, а также обжаловать действия оператора
                в Роскомнадзор (
                <a
                  href="https://rkn.gov.ru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  rkn.gov.ru
                </a>
                ).
              </p>
            </section>

            {/* Ссылка на политику */}
            <section className="bg-gray-50 rounded-xl px-4 py-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Ссылка на Политику</h2>
              <p className="text-sm text-gray-600">
                Полная информация об обработке персональных данных содержится в{" "}
                <Link href="/privacy-policy" className="text-indigo-600 hover:underline">
                  Политике обработки персональных данных
                </Link>
                , опубликованной по адресу:{" "}
                <a href="https://Yuhher.ru/privacy-policy" className="text-indigo-600 hover:underline">
                  https://Yuhher.ru/privacy-policy
                </a>
              </p>
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
