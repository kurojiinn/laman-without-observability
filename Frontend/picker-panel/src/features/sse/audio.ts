// Единственный AudioContext на всё приложение.
// Браузер требует разблокировки после пользовательского жеста.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

// Вызывать при любом жесте пользователя (click, touchstart).
export function unlockAudio(): void {
  getCtx()?.resume().catch(() => {});
}

function tone(freq: number, start: number, duration: number, context: AudioContext) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.connect(gain);
  gain.connect(context.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.4, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

// Новый заказ: восходящий "дин-дон" (позитивный).
export function playNewOrderSound(): void {
  const c = getCtx();
  if (!c) return;
  c.resume()
    .then(() => {
      const t = c.currentTime;
      tone(600, t, 0.18, c);
      tone(880, t + 0.22, 0.25, c);
    })
    .catch(() => {});
}

// Отмена заказа: нисходящий двойной сигнал (тревожный).
export function playCancelSound(): void {
  const c = getCtx();
  if (!c) return;
  c.resume()
    .then(() => {
      const t = c.currentTime;
      tone(880, t, 0.18, c);
      tone(600, t + 0.22, 0.25, c);
    })
    .catch(() => {});
}
