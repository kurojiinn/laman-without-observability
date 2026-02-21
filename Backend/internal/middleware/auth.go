package middleware

import (
	"net/http"
	"strings"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TokenValidator abstracts JWT validation to avoid package cycles.
type TokenValidator interface {
	ValidateToken(tokenString string) (uuid.UUID, error)
}

// AuthMiddleware валидирует JWT токен и устанавливает ID пользователя в контексте.
func AuthMiddleware(authService TokenValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "требуется заголовок authorization"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "неверный формат заголовка authorization"})
			c.Abort()
			return
		}

		token := parts[1]
		userID, err := authService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "неверный токен"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}
