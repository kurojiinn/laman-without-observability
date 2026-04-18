package courier

type noopCounterVec struct{}

func (noopCounterVec) WithLabelValues(...string) noopCounter { return noopCounter{} }

type noopCounter struct{}

func (noopCounter) Inc() {}

var (
	courierLocationUpdatesTotal = noopCounterVec{}
	courierLocationErrorsTotal  = noopCounterVec{}
)
