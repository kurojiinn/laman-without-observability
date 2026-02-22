package auth

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// authOperationTotal хранит количество операций auth по имени и результату.
	authOperationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_operation_total",
			Help: "Общее количество операций аутентификации и регистрации по результатам",
		},
		[]string{"operation", "result"},
	)

	// authOperationDuration хранит длительность auth-операций в секундах.
	authOperationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "auth_operation_duration_seconds",
			Help:    "Длительность операций аутентификации и регистрации в секундах",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"operation"},
	)
)
