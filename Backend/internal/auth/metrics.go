package auth

type noopCounterVec struct{}

func (noopCounterVec) WithLabelValues(...string) noopCounter { return noopCounter{} }

type noopCounter struct{}

func (noopCounter) Inc()          {}
func (noopCounter) Add(float64)   {}

type noopHistogramVec struct{}

func (noopHistogramVec) WithLabelValues(...string) noopObserver { return noopObserver{} }

type noopObserver struct{}

func (noopObserver) Observe(float64) {}

var (
	authOperationTotal    = noopCounterVec{}
	authOperationDuration = noopHistogramVec{}
)
