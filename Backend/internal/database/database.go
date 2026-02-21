package database

import (
	"context"
	"fmt"

	"Laman/internal/config"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// DB оборачивает sqlx.DB с дополнительными методами.
type DB struct {
	*sqlx.DB
}

// New создает новое подключение к базе данных.
func New(cfg *config.DatabaseConfig) (*DB, error) {
	db, err := sqlx.Connect("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("не удалось подключиться к базе данных: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("не удалось выполнить ping базы данных: %w", err)
	}

	return &DB{DB: db}, nil
}

// Close закрывает подключение к базе данных.
func (db *DB) Close() error {
	return db.DB.Close()
}

// WithTx выполняет функцию в рамках транзакции.
func (db *DB) WithTx(ctx context.Context, fn func(*sqlx.Tx) error) error {
	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		} else if err != nil {
			_ = tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	err = fn(tx)
	return err
}
