"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";
import { useBodyScrollLockWhen } from "@/hooks/useBodyScrollLock";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";

const OTP_LENGTH = 4;

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal } = useAuth();

  useBodyScrollLockWhen(isAuthModalOpen);
  const { style: swipeStyle, backdropStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: closeAuthModal, isOpen: isAuthModalOpen });

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={closeAuthModal}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-none" style={backdropStyle} />

      <div className="relative h-full flex items-end sm:items-center justify-center">
        <div
          className="relative flex flex-col w-full sm:max-w-3xl sm:mx-6 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto overscroll-contain"
          style={swipeStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle — mobile only */}
          <div className="sm:hidden flex justify-center py-2.5 flex-shrink-0 touch-none select-none cursor-grab bg-white" {...swipeHandlers}>
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="flex">
            <LeftPanel />

            <div className="relative flex flex-col w-full sm:max-w-sm bg-white px-6 sm:px-10 py-8 sm:py-10">
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

              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">
                  Вход
                </p>
                <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                  Войдите или зарегистрируйтесь
                </h2>
              </div>

              <div className="flex-1">
                <AuthForm />
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
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
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
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Yuher</span>
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
const LABEL_CLASS = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

const SUBMIT_CLASS =
  "w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm " +
  "font-semibold rounded-xl transition-all duration-150 mt-1 shadow-sm shadow-indigo-200 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

/* ─── Блок ошибки ─── */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3 py-2.5">
      <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
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

/* ─── Поле ввода телефона ─── */
function PhoneInput({
  digits,
  onChange,
  disabled,
}: {
  digits: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center h-11 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden " +
        "focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all duration-150"
      }
    >
      <span className="pl-4 pr-1 text-sm text-gray-500 font-medium select-none flex-shrink-0">+7</span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        value={digits}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="9000000000"
        disabled={disabled}
        className="flex-1 h-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none pr-4"
      />
    </div>
  );
}

/* ─── 4-ячейный ввод OTP ─── */
function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  onComplete: () => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focus = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < OTP_LENGTH - 1) focus(i + 1);
    if (digit && i === OTP_LENGTH - 1 && next.every(Boolean)) onComplete();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (value[i]) {
        const next = [...value];
        next[i] = "";
        onChange(next);
      } else if (i > 0) {
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    onChange(next);
    const focusIdx = Math.min(digits.length, OTP_LENGTH - 1);
    focus(focusIdx);
    if (digits.length === OTP_LENGTH) onComplete();
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className={
            "w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-gray-50 " +
            "text-gray-900 transition-all duration-150 focus:outline-none " +
            (value[i]
              ? "border-indigo-500 bg-white"
              : "border-gray-200 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100") +
            (disabled ? " opacity-50 cursor-not-allowed" : "")
          }
          autoComplete="one-time-code"
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

/* ─── Единая форма авторизации ─────────────────────────────────────────────── */
/*
 * Шаг 1: GET /auth/check-user → запоминаем exists
 *         POST /auth/request-code → OTP отправлен
 * Шаг 2: если exists → POST /auth/verify-code → { token, user }
 *         если нет   → POST /auth/register    → { token, user }
 */
function AuthForm() {
  const { login } = useAuth();
  const [digits, setDigits] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phone = "+7" + digits;
  const otpCode = otp.join("");

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (digits.length < 10) {
      setError("Введите 10 цифр номера");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let exists: boolean | null = null;
      try {
        const res = await authApi.checkUser(phone);
        exists = res.exists;
        setUserExists(res.exists);
      } catch {
        // check-user недоступен — продолжаем без информации
        setUserExists(null);
      }
      await authApi.requestCode(phone);
      setStep("code");
      setOtp(Array(OTP_LENGTH).fill(""));
      // Если exists === false (новый пользователь) — ничего особенного не делаем,
      // флоу одинаковый, просто вызовем register вместо verifyCode.
      void exists;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length < OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      let res;
      if (userExists === false) {
        res = await authApi.register(phone, otpCode);
      } else {
        res = await authApi.verifyCode(phone, otpCode);
      }
      login(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код");
      setOtp(Array(OTP_LENGTH).fill(""));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await handleVerify();
  };

  if (step === "phone") {
    return (
      <form onSubmit={handleRequestCode} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div>
          <label className={LABEL_CLASS}>Номер телефона</label>
          <PhoneInput digits={digits} onChange={setDigits} disabled={loading} />
        </div>
        <p className="text-xs text-gray-400">Отправим SMS с кодом подтверждения</p>
        <button type="submit" className={SUBMIT_CLASS} disabled={loading || digits.length < 10}>
          {loading ? "Проверяем..." : "Получить код"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleOtpSubmit} className="space-y-5">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
        <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
        <span className="text-xs text-indigo-600 font-medium">Код отправлен на {phone}</span>
      </div>

      <div>
        <label className={LABEL_CLASS + " text-center block"}>Код из SMS</label>
        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={handleVerify}
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        className={SUBMIT_CLASS}
        disabled={loading || otpCode.length < OTP_LENGTH}
      >
        {loading ? "Проверяем..." : userExists === false ? "Зарегистрироваться" : "Войти"}
      </button>

      <button
        type="button"
        onClick={() => { setStep("phone"); setOtp(Array(OTP_LENGTH).fill("")); setError(null); }}
        className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
      >
        ← Изменить номер
      </button>
    </form>
  );
}
