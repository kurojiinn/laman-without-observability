"use client";

import { useEffect, useMemo, useState } from "react";
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

const MIN_LEAD_HOURS = 2;
const MIN_HOUR = 8;       // первый разрешённый час старта слота, включительно
const MAX_HOUR = 22;      // первый запрещённый час старта (совпадает с проверкой бэка)
const SLOT_STEP_HOURS = 2;
const EXPRESS_PRICE = "+100 ₽";
const DAYS_AHEAD = 7;

interface TimeSlot { start: number; end: number; }

// Полное расписание для дней, отличных от сегодняшнего.
const FUTURE_DAY_SLOTS: TimeSlot[] = [
  { start: 8,  end: 10 },
  { start: 10, end: 12 },
  { start: 12, end: 14 },
  { start: 14, end: 16 },
  { start: 16, end: 18 },
  { start: 18, end: 20 },
  { start: 20, end: 22 },
];

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

function buildDays(now: Date): Date[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function slotDateOn(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Слоты для конкретного дня. Для сегодня — динамически от ceil(now + 2ч),
// шаг 2 часа, пока start < 22. Для будущих дней — полное расписание.
function buildSlotsForDay(day: Date, now: Date): TimeSlot[] {
  if (!isSameDay(day, now)) return FUTURE_DAY_SLOTS;

  const minTime = new Date(now.getTime() + MIN_LEAD_HOURS * 3600 * 1000);
  if (!isSameDay(minTime, day)) return [];   // дедлайн уже скакнул на завтра

  // Если minTime — 14:30, начинаем с 15:00. Если ровно 14:00 — с 14:00.
  let start = minTime.getHours() + (minTime.getMinutes() > 0 || minTime.getSeconds() > 0 ? 1 : 0);
  start = Math.max(MIN_HOUR, start);

  const slots: TimeSlot[] = [];
  while (start < MAX_HOUR) {
    slots.push({ start, end: start + SLOT_STEP_HOURS });
    start += SLOT_STEP_HOURS;
  }
  return slots;
}

function shortWeekday(d: Date): string {
  return d
    .toLocaleString("ru-RU", { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
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

export { DeliveryTimePicker };

export default function DeliveryTimePicker({ onSelect, defaultValue }: Props) {
  const [value, setValue] = useState<DeliveryTimeValue>(defaultValue ?? { type: "now" });
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"main" | "scheduled">("main");
  const [mounted, setMounted] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

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

  // Каждый раз при открытии sheet'а пересчитываем дни и слоты на основе свежего now.
  const { days, dailySlots } = useMemo(() => {
    const now = new Date();
    const ds = buildDays(now);
    return {
      days: ds,
      dailySlots: ds.map((d) => buildSlotsForDay(d, now)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen]);

  // При входе на экран "scheduled" дефолтим на первый день со свободными слотами.
  useEffect(() => {
    if (screen !== "scheduled") return;
    const firstAvailable = dailySlots.findIndex((s) => s.length > 0);
    setSelectedDayIdx(firstAvailable < 0 ? 0 : firstAvailable);
  }, [screen, dailySlots]);

  function close() {
    setOpen(false);
    setTimeout(() => {
      setScreen("main");
    }, 250);
  }

  function commit(next: DeliveryTimeValue) {
    setValue(next);
    onSelect(next.type, next.datetime);
    close();
  }

  const trigger = formatTriggerLabel(value);
  const selectedDay = days[selectedDayIdx] ?? days[0];
  const selectedSlots = dailySlots[selectedDayIdx] ?? [];

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
                  {/* Экран 1 — выбор типа доставки */}
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
                        onClick={() => setScreen("scheduled")}
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

                  {/* Экран 2 — кастомный календарь на 7 дней + слоты */}
                  <div className="w-full shrink-0 px-5 pb-6">
                    <div className="flex items-center mb-4">
                      <button
                        type="button"
                        onClick={() => setScreen("main")}
                        className="w-9 h-9 -ml-2 flex items-center justify-center text-white/80 hover:text-white"
                        aria-label="Назад"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h3 className="flex-1 text-center text-base font-bold text-white pr-7">Выбрать время</h3>
                    </div>

                    {/* Дни — горизонтальный скролл с snap'ом, чтобы любой день был достижим */}
                    <p className="text-[11px] uppercase tracking-wider text-[#2e4a5a] mb-2 px-1">День</p>
                    <div className="-mx-5 px-5 mb-5 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="flex gap-2 pb-1">
                        {days.map((d, idx) => {
                          const isSelected = idx === selectedDayIdx;
                          const isToday = idx === 0;
                          const isDisabled = dailySlots[idx].length === 0;
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => setSelectedDayIdx(idx)}
                              className={`shrink-0 snap-start flex flex-col items-center justify-center w-[60px] h-[68px] rounded-2xl transition-all ${
                                isSelected
                                  ? "bg-[#4B5EFC] text-white shadow-[0_4px_16px_-4px_rgba(75,94,252,0.6)]"
                                  : isDisabled
                                  ? "bg-[#0d1024] text-white/25 cursor-not-allowed"
                                  : "bg-[#152A32] text-white/80 hover:bg-[#1b3540] active:scale-[0.97]"
                              }`}
                            >
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wider ${
                                  isSelected
                                    ? "text-white/85"
                                    : isToday && !isDisabled
                                    ? "text-[#5DCAA5]"
                                    : "text-white/45"
                                }`}
                              >
                                {isToday ? "Сег" : shortWeekday(d)}
                              </span>
                              <span className="text-xl font-bold leading-tight mt-1">{d.getDate()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Слоты выбранного дня. На сегодня список пересчитывается
                        от ceil(now+2ч), так что прошедших окон в принципе нет. */}
                    <p className="text-[11px] uppercase tracking-wider text-[#2e4a5a] mb-2 px-1">Время</p>
                    {selectedSlots.length === 0 ? (
                      <p className="py-6 text-center text-sm text-white/40">
                        На этот день свободных слотов нет
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedSlots.map((s) => {
                          const slotDate = slotDateOn(selectedDay, s.start);
                          return (
                            <button
                              key={s.start}
                              type="button"
                              onClick={() => commit({ type: "scheduled", datetime: slotDate })}
                              className="py-3 rounded-2xl text-sm font-semibold bg-[#152A32] hover:bg-[#1b3540] active:scale-[0.98] text-white transition-all"
                            >
                              {pad(s.start)}:00 – {pad(s.end)}:00
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <p className="mt-4 text-[11px] text-[#2e4a5a] text-center">
                      Минимум через {MIN_LEAD_HOURS} ч от текущего времени
                    </p>
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
