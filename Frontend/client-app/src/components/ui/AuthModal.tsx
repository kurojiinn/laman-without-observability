"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { toast } from "sonner";
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
          <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 32 32" fill="none">
            <path d="M16 2C10.477 2 6 6.477 6 12c0 7.333 10 18 10 18s10-10.667 10-18C26 6.477 21.523 2 16 2z" fill="white" fillOpacity="0.25"/>
            <path d="M17.5 7L14 13.5H17.5L15 19.5L21.5 12.5H18L17.5 7Z" fill="white"/>
          </svg>
          <span className="text-white font-bold text-lg tracking-tight">Yuhher.</span>
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

const INPUT_CLASS =
  "w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm text-gray-900 " +
  "placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 " +
  "focus:ring-2 focus:ring-indigo-100 transition-all duration-150 disabled:opacity-50";

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

/* ─── Форма авторизации по email ────────────────────────────────────────────
 * Режим "login": email + пароль → POST /auth/login → JWT
 * Режим "register": email + пароль → POST /auth/register → OTP шаг →
 *                   POST /auth/verify-email → JWT
 */
function AuthForm() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpCode = otp.join("");

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setStep("credentials");
    setError(null);
    setOtp(Array(OTP_LENGTH).fill(""));
  };

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await authApi.loginWithEmail(email.trim(), password);
        login(res.token, res.user);
        toast.success("С возвращением!");
      } else {
        await authApi.registerWithEmail(email.trim(), password);
        setStep("otp");
        setOtp(Array(OTP_LENGTH).fill(""));
        toast.info("Код отправлен на email");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.verifyEmail(email.trim(), otpCode);
      login(res.token, res.user);
      toast.success("Добро пожаловать в Yuhher!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код");
      setOtp(Array(OTP_LENGTH).fill(""));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await handleVerifyOtp();
  };

  /* ── OTP шаг (только для регистрации) ── */
  if (step === "otp") {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-5">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">
            Подтверждение
          </p>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">
            Введите код
          </h2>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
          <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
          <span className="text-xs text-indigo-600 font-medium">Код отправлен на {email}</span>
        </div>

        <div>
          <label className={LABEL_CLASS + " text-center block"}>Код из письма</label>
          <OtpInput
            value={otp}
            onChange={setOtp}
            onComplete={handleVerifyOtp}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className={SUBMIT_CLASS}
          disabled={loading || otpCode.length < OTP_LENGTH}
        >
          {loading ? "Проверяем..." : "Подтвердить"}
        </button>

        <button
          type="button"
          onClick={() => { setStep("credentials"); setOtp(Array(OTP_LENGTH).fill("")); setError(null); }}
          className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
        >
          ← Изменить email
        </button>
      </form>
    );
  }

  /* ── Шаг с email + паролем ── */
  return (
    <form onSubmit={handleCredentialsSubmit} className="space-y-4">
      {/* Заголовок */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">
          {mode === "login" ? "Вход" : "Регистрация"}
        </p>
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">
          {mode === "login" ? "Войдите в аккаунт" : "Создайте аккаунт"}
        </h2>
      </div>

      {/* Переключатель режимов */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-2">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={
              "flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-150 " +
              (mode === m
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            {m === "login" ? "Вход" : "Регистрация"}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      <div>
        <label className={LABEL_CLASS}>Email</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          className={INPUT_CLASS}
          autoFocus
        />
      </div>

      <div>
        <label className={LABEL_CLASS}>Пароль</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "Минимум 8 символов" : "Введите пароль"}
            disabled={loading}
            className={INPUT_CLASS + " pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mode === "register" && (
        <p className="text-xs text-gray-400">
          После регистрации отправим код подтверждения на ваш email
        </p>
      )}

      <button
        type="submit"
        className={SUBMIT_CLASS}
        disabled={loading || !email.trim() || !password}
      >
        {loading
          ? "Подождите..."
          : mode === "login"
          ? "Войти"
          : "Зарегистрироваться"}
      </button>
    </form>
  );
}
