package picker

import (
	"github.com/google/uuid"
)

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token   string     `json:"token"`
	UserID  uuid.UUID  `json:"user_id"`
	StoreID *uuid.UUID `json:"store_id"`
	Role    string     `json:"role"`
}
type UpdateOrderStatusRequest struct {
	Status string `json:"status" binding:"required"`
}
