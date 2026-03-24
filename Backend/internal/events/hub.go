package events

import (
	"sync"

	"github.com/google/uuid"
)

type Hub struct {
	mp map[uuid.UUID]chan string
	mu sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		mp: make(map[uuid.UUID]chan string),
	}
}

func (h *Hub) Subscribe(storeID uuid.UUID) chan string {
	ch := make(chan string, 10)
	h.mu.Lock()
	h.mp[storeID] = ch
	h.mu.Unlock()
	return ch
}

func (h *Hub) Unsubscribe(storeID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if ch, ok := h.mp[storeID]; ok {
		close(ch)
		delete(h.mp, storeID)
	}
}

func (h *Hub) Notify(storeID uuid.UUID, message string) {
	h.mu.RLock()
	ch, ok := h.mp[storeID]
	h.mu.RUnlock()
	if ok {
		ch <- message
	}
}
