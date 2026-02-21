package admin

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// uploadsTotal — общее количество загруженных файлов изображений.
	uploadsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "uploads_total",
		Help: "Общее количество загруженных файлов изображений",
	})

	// importProductsDuration — время выполнения массового импорта товаров.
	importProductsDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "import_products_duration_seconds",
		Help:    "Длительность импорта товаров из Excel/CSV в секундах",
		Buckets: prometheus.DefBuckets,
	})

	// activeOrdersGauge — текущее количество активных заказов.
	activeOrdersGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "active_orders_count",
		Help: "Количество активных заказов (не доставленных)",
	})
)
