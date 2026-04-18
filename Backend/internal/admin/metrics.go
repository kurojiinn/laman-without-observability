package admin

type noopCounter struct{}

func (noopCounter) Inc()        {}
func (noopCounter) Add(float64) {}

type noopObserver struct{}

func (noopObserver) Observe(float64) {}

type noopGauge struct{}

func (noopGauge) Set(float64) {}

var (
	uploadsTotal           = noopCounter{}
	importProductsDuration = noopObserver{}
	activeOrdersGauge      = noopGauge{}
)
