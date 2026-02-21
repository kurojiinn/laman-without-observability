package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"Laman/internal/config"

	"github.com/gin-gonic/gin"
)

func TestAdminAuthMiddleware_Unauthorized(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(AdminAuthMiddleware(config.AdminConfig{
		User:     "admin",
		Password: "secret",
	}))
	router.GET("/protected", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", w.Code)
	}
}

func TestAdminAuthMiddleware_Authorized(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(AdminAuthMiddleware(config.AdminConfig{
		User:     "admin",
		Password: "secret",
	}))
	router.GET("/protected", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.SetBasicAuth("admin", "secret")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
}
