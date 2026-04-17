"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";
import { useBodyScrollLockWhen } from "@/hooks/useBodyScrollLock";

type Tab = "login" | "register";

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [tab, setTab] = useState<Tab>("login");

  useBodyScrollLockWhen(isAuthModalOpen);

  if (!isAuthModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md"
      onClick={closeAuthModal}
    >
      <div
        className="relative flex w-full sm:max-w-3xl sm:mx-6 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <LeftPanel />

        <div className="relative flex flex-col w-full sm:max-w-sm bg-white px-6 sm:px-10 py-8 sm:py-10">
          {/* Крестик */}
          <button
            onClick={closeAuthModal}
            aria-label="Закрыть"
            className="absolute top-5 right-5 p-1.5 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Заголовок */}
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">
              {tab === "login" ? "С возвращением" : "Начало"}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
              {tab === "login" ? "Войдите в аккаунт" : "Создайте аккаунт"}
            </h2>
          </div>

          {/* Переключатель вкладок */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-7">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <div className="flex-1">
            {tab === "login" ? <LoginForm /> : <RegisterForm />}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={closeAuthModal}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              Продолжить как гость →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Левая брендинговая панель ─── */
function LeftPanel() {
  return (
    <div
      className="relative hidden md:flex flex-col justify-between flex-1 p-10 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
      }}
    >
      <div
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #a5b4fc, transparent)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10 translate-x-1/3 translate-y-1/3"
        style={{ background: "radial-gradient(circle, #818cf8, transparent)" }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Laman
          </span>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          {[
            { icon: "🛒", text: "Продукты из магазинов" },
            { icon: "⚡", text: "Доставка за 30 минут" },
            { icon: "📍", text: "По всему Грозному" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-base flex-shrink-0">
                {icon}
              </div>
              <span className="text-indigo-100 text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <blockquote className="text-indigo-200 text-sm leading-relaxed italic">
          &laquo;Доставим всё, что нужно — быстро и без лишних хлопот.&raquo;
        </blockquote>
      </div>
    </div>
  );
}

/* ─── Общие стили ─── */
const INPUT_CLASS =
  "w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 " +
  "placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 " +
  "focus:ring-2 focus:ring-indigo-100 transition-all duration-150";

const LABEL_CLASS =
  "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

const SUBMIT_CLASS =
  "w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm " +
  "font-semibold rounded-xl transition-all duration-150 mt-1 shadow-sm shadow-indigo-200 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

/* ─── Блок ошибки ─── */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3 py-2.5">
      <svg
        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/* ─── Форма входа ─────────────────────────────────────────────────────────── */
/*
 * Шаг 1: POST /api/v1/auth/request-code { phone } → OTP отправлен на телефон
 * Шаг 2: POST /api/v1/auth/verify-code  { phone, code } → { token, user }
 *        Если пользователь не найден — бэкенд вернёт ошибку.
 */
function LoginForm() {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.requestCode(phone.trim());
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.verifyCode(phone.trim(), code.trim());
      login(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код");
    } finally {
      setLoading(false);
    }
  };

  if (step === "phone") {
    return (
      <form onSubmit={handleRequestCode} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div>
          <label className={LABEL_CLASS}>Номер телефона</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 (900) 000-00-00"
            className={INPUT_CLASS}
            required
            disabled={loading}
          />
        </div>
        <p className="text-xs text-gray-400">
          Отправим SMS с кодом подтверждения
        </p>
        <button type="submit" className={SUBMIT_CLASS} disabled={loading}>
          {loading ? "Отправляем..." : "Получить код"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
        <svg
          className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
        <span className="text-xs text-indigo-600 font-medium">
          Код отправлен на {phone}
        </span>
      </div>

      <div>
        <label className={LABEL_CLASS}>Код из SMS</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className={INPUT_CLASS + " text-center tracking-widest text-lg font-semibold"}
          required
          disabled={loading}
          autoFocus
        />
      </div>

      <button type="submit" className={SUBMIT_CLASS} disabled={loading}>
        {loading ? "Проверяем..." : "Войти"}
      </button>

      <button
        type="button"
        onClick={() => { setStep("phone"); setCode(""); setError(null); }}
        className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
      >
        ← Изменить номер
      </button>
    </form>
  );
}

/* ─── Форма регистрации ───────────────────────────────────────────────────── */
/*
 * Шаг 1: POST /api/v1/auth/request-code  { phone }  → OTP отправлен на телефон
 * Шаг 2: POST /api/v1/auth/register      { phone, code, role: "CLIENT" } → { token, user }
 */
function RegisterForm() {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.requestCode(phone.trim());
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.register(phone.trim(), code.trim());
      login(res.token, res.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка регистрации"
      );
    } finally {
      setLoading(false);
    }
  };

  /* Шаг 1 — ввод телефона */
  if (step === "phone") {
    return (
      <form onSubmit={handleRequestCode} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div>
          <label className={LABEL_CLASS}>Номер телефона</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 (900) 000-00-00"
            className={INPUT_CLASS}
            required
            disabled={loading}
          />
        </div>
        <p className="text-xs text-gray-400">
          Отправим SMS с кодом подтверждения
        </p>
        <button type="submit" className={SUBMIT_CLASS} disabled={loading}>
          {loading ? "Отправляем..." : "Получить код"}
        </button>
      </form>
    );
  }

  /* Шаг 2 — ввод кода */
  return (
    <form onSubmit={handleRegister} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
        <svg
          className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
        <span className="text-xs text-indigo-600 font-medium">
          Код отправлен на {phone}
        </span>
      </div>

      <div>
        <label className={LABEL_CLASS}>Код из SMS</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className={INPUT_CLASS + " text-center tracking-widest text-lg font-semibold"}
          required
          disabled={loading}
          autoFocus
        />
      </div>

      <button type="submit" className={SUBMIT_CLASS} disabled={loading}>
        {loading ? "Регистрируем..." : "Зарегистрироваться"}
      </button>

      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setCode("");
          setError(null);
        }}
        className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
      >
        ← Изменить номер
      </button>
    </form>
  );
}
