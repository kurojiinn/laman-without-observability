"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DeliveryType = "now" | "scheduled" | "express";

export interface DeliveryTimeValue {
  type: DeliveryType;
  datetime?: Date;
}

interface Props {
  onSelect: (type: DeliveryType, datetime?: Date) => void;
  defaultValue?: DeliveryTimeValue;
}

const MIN_HOUR = 8;
const MAX_HOUR = 22;
const MIN_LEAD_HOURS = 2;
const EXPRESS_PRICE = "+100 ₽";

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTriggerLabel(v: DeliveryTimeValue): { icon: string; text: string; accent: boolean } {
  if (v.type === "express") {
    return { icon: "⚡", text: `Срочная доставка ${EXPRESS_PRICE}`, accent: true };
  }
  if (v.type === "scheduled" && v.datetime) {
    const d = v.datetime;
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const dayLabel = isSameDay(d, today)
      ? "Сегодня"
      : isSameDay(d, tomorrow)
      ? "Завтра"
      : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
    return { icon: "🕕", text: `${dayLabel} в ${pad(d.getHours())}:${pad(d.getMinutes())}`, accent: false };
  }
  return { icon: "🕐", text: "Привезти сейчас", accent: false };
}

interface QuickSlot {
  id: string;
  label: string;
  date: Date;
}

function buildQuickSlots(now: Date): QuickSlot[] {
  const minTime = new Date(now.getTime() + MIN_LEAD_HOURS * 3600 * 1000);
  const slots: QuickSlot[] = [];

  const today18 = new Date(now);
  today18.setHours(18, 0, 0, 0);
  if (today18 > minTime) {
    slots.push({ id: "today-18", label: "Сегодня 18:00–20:00", date: today18 });
  }

  const tomorrow9 = new Date(now);
  tomorrow9.setDate(now.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);
  slots.push({ id: "tomorrow-9", label: "Завтра 9:00–11:00", date: tomorrow9 });

  const tomorrow18 = new Date(now);
  tomorrow18.setDate(now.getDate() + 1);
  tomorrow18.setHours(18, 0, 0, 0);
  slots.push({ id: "tomorrow-18", label: "Завтра 18:00–20:00", date: tomorrow18 });

  return slots;
}

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { DeliveryTimePicker };

export default function DeliveryTimePicker({ onSelect, defaultValue }: Props) {
  const [value, setValue] = useState<DeliveryTimeValue>(defaultValue ?? { type: "now" });
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"main" | "scheduled">("main");
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setTimeout(() => {
      setScreen("main");
      setError(null);
    }, 250);
  }

  function commit(next: DeliveryTimeValue) {
    setValue(next);
    onSelect(next.type, next.datetime);
    close();
  }

  function openNativePicker() {
    const el = inputRef.current;
    if (!el) return;
    // showPicker — современный API; иначе фокус откроет нативный диалог на мобильных.
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // упадём в фолбек
      }
    }
    el.focus();
    el.click();
  }

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const d = new Date(e.target.value);
    const now = new Date();
    const minTime = new Date(now.getTime() + MIN_LEAD_HOURS * 3600 * 1000);
    if (d < minTime) {
      setError(`Минимум через ${MIN_LEAD_HOURS} ч от текущего времени`);
      return;
    }
    if (d.getHours() < MIN_HOUR || d.getHours() >= MAX_HOUR) {
      setError(`Доступные часы: ${MIN_HOUR}:00–${MAX_HOUR}:00`);
      return;
    }
    commit({ type: "scheduled", datetime: d });
  }

  const trigger = formatTriggerLabel(value);
  const slots = buildQuickSlots(new Date());
  const minInput = toLocalInputValue(new Date(Date.now() + MIN_LEAD_HOURS * 3600 * 1000));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-full max-w-[380px] px-4 py-3.5 rounded-2xl bg-[#121430] hover:bg-[#171a3a] active:scale-[0.99] transition-all text-left"
      >
        <span
          className={`flex items-center justify-center w-10 h-10 rounded-xl text-lg shrink-0 ${
            trigger.accent ? "bg-[#5DCAA5]/15 text-[#5DCAA5]" : "bg-[#152A32] text-white"
          }`}
        >
          {trigger.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[#2e4a5a] mb-0.5">Время доставки</p>
          <p className={`text-sm font-semibold truncate ${trigger.accent ? "text-[#5DCAA5]" : "text-white"}`}>
            {trigger.text}
          </p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#2e4a5a] shrink-0">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted &&
        createPortal(
          <div
            className={`fixed inset-0 z-[10000] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
            aria-hidden={!open}
          >
            <div
              onClick={close}
              className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
                open ? "opacity-100" : "opacity-0"
              }`}
            />

            <div
              role="dialog"
              aria-modal="true"
              className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-[380px] bg-[#121430] rounded-t-3xl shadow-2xl overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                open ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: screen === "main" ? "translateX(0%)" : "translateX(-100%)" }}
                >
                  <div className="w-full shrink-0 px-5 pb-6">
                    <h3 className="text-base font-bold text-white mb-4 text-center">Когда привезти?</h3>

                    <div className="flex flex-col gap-2">
                      <Option
                        icon="🕐"
                        title="Привезти сейчас"
                        subtitle="Стандартная доставка"
                        selected={value.type === "now"}
                        onClick={() => commit({ type: "now" })}
                      />
                      <Option
                        icon="🕕"
                        title="Указать время"
                        subtitle="Выбрать удобный слот"
                        selected={value.type === "scheduled"}
                        onClick={() => {
                          setError(null);
                          setScreen("scheduled");
                        }}
                        hasArrow
                      />
                      <Option
                        icon="⚡"
                        title="Срочная доставка"
                        subtitle="Доставим в первую очередь"
                        badge={EXPRESS_PRICE}
                        accent
                        selected={value.type === "express"}
                        onClick={() => commit({ type: "express" })}
                      />
                    </div>
                  </div>

                  <div className="w-full shrink-0 px-5 pb-6">
                    <div className="flex items-center mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          setScreen("main");
                          setError(null);
                        }}
                        className="w-9 h-9 -ml-2 flex items-center justify-center text-white/80 hover:text-white"
                        aria-label="Назад"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h3 className="flex-1 text-center text-base font-bold text-white pr-7">Выбрать время</h3>
                    </div>

                    <p className="text-[11px] uppercase tracking-wider text-[#2e4a5a] mb-2 px-1">Быстрые слоты</p>
                    <div className="flex flex-col gap-2 mb-4">
                      {slots.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => commit({ type: "scheduled", datetime: s.date })}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#152A32] hover:bg-[#1b3540] active:scale-[0.99] text-white text-sm font-medium transition-all"
                        >
                          <span className="text-base">🕒</span>
                          <span className="flex-1 text-left">{s.label}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={openNativePicker}
                      className="w-full py-3.5 rounded-2xl bg-[#4B5EFC] hover:bg-[#3f51e0] active:scale-[0.99] text-white text-sm font-bold transition-all"
                    >
                      Выбрать другое время
                    </button>

                    {error && <p className="mt-3 text-xs text-red-400 text-center">{error}</p>}

                    <p className="mt-3 text-[11px] text-[#2e4a5a] text-center">
                      Доступные часы: {MIN_HOUR}:00–{MAX_HOUR}:00, минимум через {MIN_LEAD_HOURS} ч
                    </p>

                    <input
                      ref={inputRef}
                      type="datetime-local"
                      min={minInput}
                      onChange={handleNativeChange}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

interface OptionProps {
  icon: string;
  title: string;
  subtitle?: string;
  badge?: string;
  selected?: boolean;
  accent?: boolean;
  hasArrow?: boolean;
  onClick: () => void;
}

function Option({ icon, title, subtitle, badge, selected, accent, hasArrow, onClick }: OptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left active:scale-[0.99] transition-all ${
        accent
          ? "bg-[#5DCAA5]/10 hover:bg-[#5DCAA5]/15 border border-[#5DCAA5]/30"
          : "bg-[#152A32] hover:bg-[#1b3540] border border-transparent"
      } ${selected ? (accent ? "ring-2 ring-[#5DCAA5]" : "ring-2 ring-[#4B5EFC]") : ""}`}
    >
      <span
        className={`flex items-center justify-center w-10 h-10 rounded-xl text-lg shrink-0 ${
          accent ? "bg-[#5DCAA5]/20 text-[#5DCAA5]" : "bg-[#08091C] text-white"
        }`}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold truncate ${accent ? "text-[#5DCAA5]" : "text-white"}`}>{title}</p>
          {badge && (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                accent ? "bg-[#5DCAA5] text-[#08091C]" : "bg-[#4B5EFC] text-white"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-[#2e4a5a] truncate mt-0.5">{subtitle}</p>}
      </div>
      {hasArrow && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#2e4a5a] shrink-0">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
