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

// TokenRevoker добавляет JWT-токены в блэклист (deny-list).
//
// Как работает механизм:
//  1. При выдаче токена в него вкладывается уникальный `jti` (JWT ID) — uuid.
//  2. При logout JTI сохраняется в Redis с TTL = оставшееся время жизни токена.
//  3. ValidateToken проверяет: не в блэклисте ли этот JTI?
//
// Почему блэклист, а не вайтлист (хранить все активные токены):
//   - Блэклист хранит только ОТОЗВАННЫЕ токены — их мало
//   - Вайтлист хранил бы ВСЕ активные токены — их много
//   - При 100к пользователей блэклист может быть пустым если никто не логаутится
//   - Вайтлист всегда содержит 100к записей
//
// Ограничение этого подхода: нельзя "разлогинить всех пользователей сразу"
// без смены JWT секрета. Для этого нужна другая схема (версионирование токенов).
// Для стартапа блэклист — оптимальный баланс простоты и безопасности.
type TokenRevoker interface {
	// Revoke добавляет JTI токена в блэклист с TTL.
	// TTL должен быть равен оставшемуся времени жизни токена.
	Revoke(ctx context.Context, jti string, ttl time.Duration) error

	// IsRevoked проверяет находится ли токен в блэклисте.
	// Возвращает false при ошибке Redis — graceful degradation.
	IsRevoked(ctx context.Context, jti string) (bool, error)
}

// =============================================================================
// REDIS РЕАЛИЗАЦИЯ
// =============================================================================

// RedisTokenRevoker хранит блэклист JTI в Redis.
//
// Ключ: "jwt:revoked:{jti}" (из cache.JWTRevokedKey)
// Значение: "1" (само значение неважно, важен факт существования ключа)
// TTL: время до истечения токена
//
// Операции:
//   - Revoke: SET jwt:revoked:{jti} "1" EX {ttl_seconds}
//   - IsRevoked: GET jwt:revoked:{jti} → EXISTS = revoked, NOT_EXISTS = valid
//
// Почему не использовать SADD (Sets):
//   - SET с TTL — каждый ключ удаляется автоматически
//   - SADD в один ключ — нельзя задать разный TTL для разных токенов,
//     пришлось бы чистить Set вручную через cron
type RedisTokenRevoker struct {
	rdb *redis.Client
}

// NewRedisTokenRevoker создаёт новый RevokER блэклист на Redis.
func NewRedisTokenRevoker(rdb *redis.Client) TokenRevoker {
	return &RedisTokenRevoker{rdb: rdb}
}

// Revoke сохраняет JTI в Redis с указанным TTL.
func (r *RedisTokenRevoker) Revoke(ctx context.Context, jti string, ttl time.Duration) error {
	key := fmt.Sprintf(cache.JWTRevokedKey, jti)
	if err := r.rdb.Set(ctx, key, "1", ttl).Err(); err != nil {
		return fmt.Errorf("redis set revoked token: %w", err)
	}
	return nil
}

// IsRevoked проверяет наличие JTI в блэклисте.
//
// redis.Nil означает что ключ не найден — токен валиден.
// Любая другая ошибка Redis возвращается вызывающему коду,
// который сам решает: заблокировать или пропустить (graceful degradation).
func (r *RedisTokenRevoker) IsRevoked(ctx context.Context, jti string) (bool, error) {
	key := fmt.Sprintf(cache.JWTRevokedKey, jti)
	err := r.rdb.Get(ctx, key).Err()
	if errors.Is(err, redis.Nil) {
		return false, nil // ключ не найден — не в блэклисте
	}
	if err != nil {
		return false, fmt.Errorf("redis get revoked token: %w", err)
	}
	return true, nil // ключ существует — токен отозван
}

// =============================================================================
// NOOP РЕАЛИЗАЦИЯ
// =============================================================================

// NoopTokenRevoker ничего не отзывает — для тестов и dev-окружения.
// Паттерн Null Object: не нужна проверка на nil по всему коду.
type NoopTokenRevoker struct{}

func NewNoopTokenRevoker() TokenRevoker { return &NoopTokenRevoker{} }

func (n *NoopTokenRevoker) Revoke(_ context.Context, _ string, _ time.Duration) error {
	return nil
}

func (n *NoopTokenRevoker) IsRevoked(_ context.Context, _ string) (bool, error) {
	return false, nil
}
