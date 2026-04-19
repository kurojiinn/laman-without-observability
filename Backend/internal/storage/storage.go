package storage

import "context"

// Provider — интерфейс для загрузки файлов в объектное хранилище.
type Provider interface {
	Upload(ctx context.Context, key, contentType string, data []byte) (url string, err error)
}
