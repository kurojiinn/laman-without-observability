package models

import (
	"time"

	"github.com/google/uuid"
)

// User представляет зарегистрированного пользователя в системе.
type User struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Phone     string    `db:"phone" json:"phone"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// UserProfile представляет информацию профиля пользователя.
type UserProfile struct {
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	Name      string    `db:"name" json:"name"`
	Email     *string   `db:"email" json:"email,omitempty"`
	Address   *string   `db:"address" json:"address,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}
