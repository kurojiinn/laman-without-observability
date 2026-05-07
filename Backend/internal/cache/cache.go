package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Префиксы кеш-ключей справочников каталога.
// Меняются редко (раз в несколько минут/часов) — идеальные кандидаты для кеша.
const (
	KeyCategories         = "cache:categories"
	KeyStores             = "cache:stores"             // суффикс :all|:search:{q}
	KeyScenarios          = "cache:scenarios:active"
	KeyFeatured           = "cache:featured:%s"        // %s = block_type
	KeyStoreCategoryMeta  = "cache:storecatmeta"
	KeyRecipes            = "cache:recipes"
	KeyStoreSubcategories = "cache:store-subcat:%s"    // %s = store_id
)

// GetOrSet — стандартный паттерн "Cache-Aside":
//  1. Пробуем достать из Redis
//  2. На промахе — вызываем fetch, кладём результат в Redis
//  3. Если Redis недоступен — игнорируем ошибку и возвращаем результат fetch
//
// Generics требует Go 1.21+; T должен быть JSON-сериализуемым.
//
// Graceful degradation: ошибки Redis не пропагируются наверх — лучше
// "медленнее без кеша" чем "уронить запрос".
func GetOrSet[T any](
	ctx context.Context,
	rdb *redis.Client,
	key string,
	ttl time.Duration,
	fetch func() (T, error),
) (T, error) {
	var zero T

	if rdb != nil {
		raw, err := rdb.Get(ctx, key).Bytes()
		if err == nil {
			var v T
			if jsonErr := json.Unmarshal(raw, &v); jsonErr == nil {
				return v, nil
			}
			// Битые данные в кеше — пропускаем, перезапишем свежими.
		}
	}

	value, err := fetch()
	if err != nil {
		return zero, err
	}

	if rdb != nil {
		if data, marshalErr := json.Marshal(value); marshalErr == nil {
			// SetEx — атомарная установка значения с TTL.
			// Ошибку записи в Redis игнорируем — данные уже есть на руках.
			_ = rdb.SetEx(ctx, key, data, ttl).Err()
		}
	}

	return value, nil
}

// Invalidate удаляет один или несколько ключей из кеша.
// Используется при write-операциях (admin update/create/delete).
//
// Ошибку Redis намеренно игнорируем — write-путь и без кеша должен работать.
func Invalidate(ctx context.Context, rdb *redis.Client, keys ...string) {
	if rdb == nil || len(keys) == 0 {
		return
	}
	_ = rdb.Del(ctx, keys...).Err()
}

// InvalidatePattern удаляет все ключи по wildcard-паттерну (например cache:stores:*).
// Использует SCAN — безопасно даже на больших ключевых пространствах.
//
// ⚠️ Не для горячих путей: SCAN — O(n). Для частых инвалидаций
// лучше держать список ключей в отдельном set'е.
func InvalidatePattern(ctx context.Context, rdb *redis.Client, pattern string) {
	if rdb == nil {
		return
	}
	iter := rdb.Scan(ctx, 0, pattern, 100).Iterator()
	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if len(keys) > 0 {
		_ = rdb.Del(ctx, keys...).Err()
	}
}

// FormatKey подставляет аргументы в шаблон ключа (sprintf-обёртка).
// Используется чтобы единообразно собирать ключи: cache:featured:hits, cache:store-subcat:abc-123 ...
func FormatKey(template string, args ...any) string {
	return fmt.Sprintf(template, args...)
}
