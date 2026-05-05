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

// AuthMiddleware валидирует JWT токен из заголовка Authorization или httpOnly cookie.
func AuthMiddleware(authService TokenValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c, false)
		if token == "" {
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

// SSEAuthMiddleware валидирует JWT токен и дополнительно принимает его через ?token=
// query-параметр. Используется только для SSE-эндпоинтов, так как EventSource
// в браузере не поддерживает произвольные заголовки.
func SSEAuthMiddleware(authService TokenValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c, true)
		if token == "" {
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

// extractToken извлекает JWT из заголовка Authorization или httpOnly cookie.
// Если allowQueryToken = true, также принимает ?token= (только для SSE).
func extractToken(c *gin.Context, allowQueryToken bool) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			return parts[1]
		}
		return ""
	}
	if cookie, err := c.Cookie("auth_token"); err == nil && cookie != "" {
		return cookie
	}
	if allowQueryToken {
		if t := c.Query("token"); t != "" {
			return t
		}
	}
	return ""
}
