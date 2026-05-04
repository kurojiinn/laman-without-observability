package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	UserRoleClient = "CLIENT"
	UserRolePicker = "PICKER"
)

// IsValidUserRole проверяет, что роль пользователя поддерживается системой.
func IsValidUserRole(role string) bool {
	switch role {
	case UserRoleClient, UserRolePicker:
		return true
	default:
		return false
	}
}

// User представляет зарегистрированного пользователя в системе.
type User struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	Phone        string     `db:"phone" json:"phone"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
	Role         string     `db:"role" json:"role"`
	StoreID      *uuid.UUID `db:"store_id" json:"store_id,omitempty"`
	PasswordHash *string    `db:"password_hash" json:"-"`
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
