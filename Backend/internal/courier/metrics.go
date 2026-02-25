package courier

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	courierLocationUpdatesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "courier_location_updates_total",
			Help: "Общее количество обновлений локации",
		},
		[]string{"courier_id"},
	)
	courierLocationErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "courier_location_errors_total",
			Help: "Общее количество ошибок локации",
		},
		[]string{"reason"},
	)
)
