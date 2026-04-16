package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RoleRequired проверяет, что пользователь имеет одну из разрешённых ролей.
// Должен вызываться после AuthMiddleware, который устанавливает "user_role" в контексте.
func RoleRequired(allowedRoles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedRoles))
	for _, r := range allowedRoles {
		allowed[r] = struct{}{}
	}

	return func(c *gin.Context) {
		role, _ := c.Get("user_role")
		roleStr, _ := role.(string)

		if _, ok := allowed[roleStr]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "доступ запрещён"})
			return
		}

		c.Next()
	}
}
