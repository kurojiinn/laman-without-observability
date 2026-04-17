package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequireAdminRole проверяет, что аутентифицированный пользователь имеет роль ADMIN.
// Должен использоваться после AuthMiddleware.
func RequireAdminRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists || role.(string) != "ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "доступ только для администратора"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// TokenValidator abstracts JWT validation to avoid package cycles.
type TokenValidator interface {
	ValidateToken(ctx context.Context, tokenString string) (uuid.UUID, string, error)
}

// AuthMiddleware валидирует JWT токен и устанавливает ID пользователя и роль в контексте.
// Принимает токен из заголовка Authorization или query-параметра token (для SSE).
func AuthMiddleware(authService TokenValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "неверный формат заголовка authorization"})
				c.Abort()
				return
			}
			token = parts[1]
		} else if cookie, err := c.Cookie("auth_token"); err == nil && cookie != "" {
			// Второй приоритет: httpOnly cookie (web-клиент)
			token = cookie
		} else if t := c.Query("token"); t != "" {
			// Третий приоритет: query-param для SSE (EventSource не поддерживает заголовки)
			token = t
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "требуется заголовок authorization"})
			c.Abort()
			return
		}

		userID, role, err := authService.ValidateToken(c.Request.Context(), token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "неверный токен"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Set("user_role", role)
		c.Next()
	}
}
