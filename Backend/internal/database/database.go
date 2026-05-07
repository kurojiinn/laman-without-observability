// Package database предоставляет обёртку над sqlx.DB с утилитами для работы
// с транзакциями и управления подключением к PostgreSQL.
package database

import (
	"context"
	"fmt"
	"time"

	"Laman/internal/config"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// DB оборачивает sqlx.DB и добавляет вспомогательные методы,
// в частности транзакционный хелпер WithTx.
type DB struct {
	*sqlx.DB
}

// New открывает подключение к PostgreSQL и проверяет его через Ping.
// Возвращает ошибку если соединение установить не удалось.
func New(cfg *config.DatabaseConfig) (*DB, error) {
	db, err := sqlx.Connect("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("не удалось подключиться к базе данных: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("не удалось выполнить ping базы данных: %w", err)
	}

	// Пул соединений. Значения по умолчанию у sqlx: MaxOpenConns=0 (unlimited),
	// MaxIdleConns=2 — приводят либо к перегрузке Postgres, либо к постоянному
	// открытию/закрытию соединений под нагрузкой.
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	return &DB{DB: db}, nil
}

// Close закрывает подключение к базе данных.
func (db *DB) Close() error {
	return db.DB.Close()
}

// WithTx выполняет fn внутри транзакции и гарантирует атомарный исход:
//   - если fn вернула ошибку → транзакция откатывается, ошибка fn пробрасывается наверх
//   - если fn вернула nil → транзакция коммитится; ошибка Commit() тоже пробрасывается
//   - если внутри fn случилась паника → транзакция откатывается, паника продолжается
//
// Именованный возврат (err error) — ключевой момент реализации.
// Он позволяет defer-замыканию перезаписать возвращаемое значение после return,
// что необходимо чтобы ошибка tx.Commit() не терялась.
//
// Порядок выполнения в Go при именованном возврате:
//  1. err = fn(tx)         — выполняем бизнес-логику
//  2. return               — Go фиксирует, что вернём именованную переменную err
//  3. defer запускается    — может изменить err (например, err = tx.Commit())
//  4. фактический возврат  — уже изменённое defer-ом значение err
func (db *DB) WithTx(ctx context.Context, fn func(*sqlx.Tx) error) (err error) {
	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("не удалось начать транзакцию: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			// Паника внутри fn — откатываем и продолжаем панику.
			_ = tx.Rollback()
			panic(p)
		}
		if err != nil {
			// fn вернула ошибку — откатываем транзакцию.
			// Ошибку Rollback намеренно игнорируем: основная ошибка из fn важнее.
			_ = tx.Rollback()
			return
		}
		// fn успешна — коммитим. Ошибка Commit (дедлок, сетевой сбой)
		// теперь корректно возвращается вызывающему через именованный err.
		err = tx.Commit()
	}()

	err = fn(tx)
	return
}
