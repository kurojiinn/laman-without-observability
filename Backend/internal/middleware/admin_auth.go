package middleware

import (
	"net/http"

	"Laman/internal/config"

	"github.com/gin-gonic/gin"
)

// AdminAuthMiddleware защищает admin-роуты простым Basic Auth.
func AdminAuthMiddleware(cfg config.AdminConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, pass, ok := c.Request.BasicAuth()
		if !ok || user != cfg.User || pass != cfg.Password {
			c.Header("WWW-Authenticate", `Basic realm="admin"`)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		c.Next()
	}
}
