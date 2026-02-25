package courier

import (
	"Laman/internal/cache"
	"Laman/internal/observability"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type redisCourierRepository struct {
	client *redis.Client
}

// NewRedisCourierRepository создаёт новый репозиторий позиций курьеров на основе Redis.
func NewRedisCourierRepository(client *redis.Client) Repository {
	return &redisCourierRepository{client: client}
}

type locationCache struct {
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// SetLocation добавляем данные о местоположении в кеш
func (r *redisCourierRepository) SetLocation(ctx context.Context, courierID uuid.UUID, lat, lng float64) error {
	ctx, span := observability.StartSpan(ctx, "courier.redis.set_location")
	defer span.End()
	key := fmt.Sprintf(cache.CourierLocationKey, courierID.String())
	ttl := 5 * time.Minute
	data := locationCache{
		Lat:       lat,
		Lng:       lng,
		UpdatedAt: time.Now(),
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("не удалось сериализовать данные в JSON: %w", err)
	}

	if err := r.client.Set(ctx, key, jsonBytes, ttl).Err(); err != nil {
		return fmt.Errorf("не удалось записать данные в кеш, %w", err)
	}

	return nil
}

// GetLocation получает данные о местоположении из кеша
func (r *redisCourierRepository) GetLocation(ctx context.Context, courierID uuid.UUID) (*Location, error) {
	ctx, span := observability.StartSpan(ctx, "courier.redis.get_location")
	defer span.End()
	
	key := fmt.Sprintf(cache.CourierLocationKey, courierID.String())
	bytes, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		// redis.Nil означает что ключ не существует — курьер не активен или TTL истёк
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		return nil, err
	}

	data := &locationCache{}
	err = json.Unmarshal(bytes, data)
	if err != nil {
		return nil, fmt.Errorf("не удалось десериализовать данные позиции: %w", err)
	}
	return &Location{
		Lat:       data.Lat,
		Lng:       data.Lng,
		UpdatedAt: data.UpdatedAt,
	}, nil
}
