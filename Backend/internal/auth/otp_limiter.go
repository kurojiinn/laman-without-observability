package auth

import (
	"Laman/internal/cache"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// =============================================================================
// ИНТЕРФЕЙС
// =============================================================================

// OTPLimiter ограничивает количество попыток ввода OTP-кода по номеру телефона.
//
// Почему интерфейс, а не сразу конкретная структура:
//   - позволяет подменить реализацию в тестах без поднятия Redis
//   - в будущем можно сделать реализацию поверх in-memory map или Memcached
//
// В крупных Go-проектах (Uber, Google, Cloudflare) интерфейс определяется
// на стороне ПОТРЕБИТЕЛЯ, а не реализации. Это называется "consumer-driven interface".
// Здесь потребитель — пакет auth (service.go), поэтому интерфейс живёт здесь.
//
// Частая ошибка новичков: определять интерфейс рядом с реализацией.
// Тогда теряется смысл — потребитель всё равно импортирует пакет реализации.
type OTPLimiter interface {
	// CheckAndIncrement проверяет счётчик и атомарно увеличивает его на 1.
	// Возвращает сколько попыток осталось и заблокирован ли телефон.
	//
	// Важно: метод ВСЕГДА увеличивает счётчик — даже если после этого
	// код окажется верным. Это намеренно: если уменьшать только при ошибке,
	// злоумышленник после 5 неверных попыток запросит новый код и начнёт заново.
	CheckAndIncrement(ctx context.Context, phone string) (attemptsLeft int, blocked bool, err error)

	// Reset сбрасывает счётчик после успешной верификации.
	// Вызывается ТОЛЬКО при успехе — чтобы следующий вход начинался с нуля.
	Reset(ctx context.Context, phone string) error
}

// =============================================================================
// REDIS РЕАЛИЗАЦИЯ
// =============================================================================

// RedisOTPLimiter хранит счётчики попыток в Redis с автоматическим TTL.
//
// Почему Redis, а не PostgreSQL для этой задачи:
//   - TTL встроен нативно — не нужен cron-job для удаления устаревших записей
//   - операция INCR атомарна — нет race condition при параллельных запросах
//   - скорость: Redis отвечает за ~0.1ms, Postgres за ~5-10ms
//   - не засоряем основную БД временными служебными данными
//
// Именно так реализован rate limiting в Stripe API, GitHub API, Twilio Verify:
// Redis + INCR + TTL — стандартный индустриальный паттерн для счётчиков.
type RedisOTPLimiter struct {
	rdb         *redis.Client
	maxAttempts int
	blockTTL    time.Duration
}

// NewRedisOTPLimiter создаёт новый лимитер попыток.
//
// Рекомендованные значения для продакшена:
//   - maxAttempts = 5  (Twilio использует 5, Google Authenticator — 10)
//   - blockTTL = 15 минут (баланс: достаточно неудобно для атаки, не слишком долго для пользователя)
//
// Почему blockTTL важен:
//   - Слишком короткий (1-2 мин) → злоумышленник просто ждёт и пробует снова
//   - Слишком длинный (1 час+) → плохой UX: настоящий пользователь злится
func NewRedisOTPLimiter(rdb *redis.Client, maxAttempts int, blockTTL time.Duration) OTPLimiter {
	return &RedisOTPLimiter{
		rdb:         rdb,
		maxAttempts: maxAttempts,
		blockTTL:    blockTTL,
	}
}

// CheckAndIncrement атомарно увеличивает счётчик и проверяет блокировку.
//
// ⚠️ ЧАСТАЯ ОШИБКА: использовать GET → проверка → SET вместо INCR.
//
//	Проблема: GET и SET — две отдельные операции. Между ними другой горутиной
//	может быть сделан ещё один запрос. Оба читают одно значение, оба пишут
//	одно новое — один инкремент теряется. Это называется race condition / TOCTOU.
//
//	Правильно: INCR — одна атомарная операция Redis, race condition невозможен.
func (l *RedisOTPLimiter) CheckAndIncrement(ctx context.Context, phone string) (int, bool, error) {
	key := fmt.Sprintf(cache.OTPAttemptsKey, phone)

	// INCR атомарно:
	//   - создаёт ключ со значением 1, если его нет
	//   - увеличивает существующее значение на 1
	// Возвращает новое значение счётчика.
	count, err := l.rdb.Incr(ctx, key).Result()
	if err != nil {
		// ⚠️ ВАЖНО: при недоступности Redis НЕ блокируем пользователя.
		// Возвращаем ошибку — вызывающий код сам решит как обработать (graceful degradation).
		//
		// Плохо: return 0, true, nil  — при падении Redis блокируем ВСЕХ пользователей.
		// Хорошо: возвращаем ошибку, сервис продолжает работу без защиты.
		//
		// Компромисс: лучше пропустить атаку в момент падения Redis, чем заблокировать
		// всех реальных пользователей. Мониторинг Redis отдельная задача.
		return 0, false, fmt.Errorf("redis incr: %w", err)
	}

	// TTL устанавливаем ТОЛЬКО при первом инкременте (count == 1).
	//
	// ⚠️ ЧАСТАЯ ОШИБКА: устанавливать Expire при каждом INCR.
	//
	//	Если сдвигать TTL при каждой попытке — злоумышленник делает одну попытку
	//	каждые 14:59 минут и никогда не получает блокировку, счётчик никогда не сбрасывается.
	//	Это называется "sliding window TTL bypass attack".
	//
	//	Правильно: TTL фиксируется при создании ключа и больше не сдвигается.
	//	Именно так работают Twilio Verify и AWS Cognito OTP.
	if count == 1 {
		if err := l.rdb.Expire(ctx, key, l.blockTTL).Err(); err != nil {
			// Не удалось поставить TTL → ключ останется в Redis навсегда.
			// Это хуже чем пропустить попытку, поэтому удаляем ключ.
			_ = l.rdb.Del(ctx, key)
			return 0, false, fmt.Errorf("redis expire: %w", err)
		}
	}

	// Проверяем блокировку ПОСЛЕ инкремента.
	// Это значит: 6-я попытка тоже заблокирована, а не "последняя разрешённая".
	if int(count) > l.maxAttempts {
		return 0, true, nil
	}

	attemptsLeft := l.maxAttempts - int(count)
	return attemptsLeft, false, nil
}

// Reset удаляет счётчик попыток после успешной верификации.
//
// Вызывается только при успехе. Это критично:
// если вызывать Reset при любом исходе — защита полностью теряет смысл.
//
// Ошибку Reset не нужно возвращать пользователю — он уже прошёл верификацию.
// Достаточно залогировать на стороне вызывающего кода.
// Это паттерн "best-effort cleanup", используемый в Stripe и Twilio.
func (l *RedisOTPLimiter) Reset(ctx context.Context, phone string) error {
	key := fmt.Sprintf(cache.OTPAttemptsKey, phone)

	// redis.Nil означает что ключ уже не существует — это нормально, не ошибка.
	if err := l.rdb.Del(ctx, key).Err(); err != nil && !errors.Is(err, redis.Nil) {
		return fmt.Errorf("redis del: %w", err)
	}
	return nil
}

// =============================================================================
// NOOP РЕАЛИЗАЦИЯ
// =============================================================================

// NoopOTPLimiter всегда пропускает запросы без каких-либо ограничений.
//
// Используется в двух случаях:
//  1. В unit-тестах — чтобы не поднимать Redis
//  2. Как fallback когда Redis недоступен при старте
//
// Это паттерн "Null Object" из книги "Refactoring" Мартина Фаулера.
// Суть: вместо проверки на nil по всему коду — объект который ничего не делает.
//
// Плохо (проверка nil везде):
//
//	if limiter != nil {
//	    limiter.CheckAndIncrement(...)
//	}
//
// Хорошо (Null Object):
//
//	limiter.CheckAndIncrement(...)  // NoopOTPLimiter просто вернёт "всё ок"
//
// Так же устроен NoopSMSProvider в этом проекте.
type NoopOTPLimiter struct{}

func NewNoopOTPLimiter() OTPLimiter { return &NoopOTPLimiter{} }

func (n *NoopOTPLimiter) CheckAndIncrement(_ context.Context, _ string) (int, bool, error) {
	// Всегда возвращаем maxAttempts=5 — условный "полный запас".
	return 5, false, nil
}

func (n *NoopOTPLimiter) Reset(_ context.Context, _ string) error {
	return nil
}
