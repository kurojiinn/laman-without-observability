package cache

import (
	"Laman/internal/config"
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	rdb *redis.Client
}

func New(cfg *config.RedisConfig) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr(),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	//проверяем подключение через Ping
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("не удалось выполнить ping для кеширования: %w", err)
	}
	return &Client{rdb: rdb}, nil
}

func (c *Client) Close() error {
	return c.rdb.Close()
}
