// Package events реализует SSE (Server-Sent Events) Hub —
// механизм доставки real-time уведомлений клиентам и сборщикам (picker).
//
// Архитектура:
//   - Hub хранит map: topic → {subscriberID → channel}.
//   - topic для клиента = userID, для пикера = storeID.
//   - subscriberID всегда = userID (уникален на уровне пользователя).
//   - Notify(topic) рассылает сообщение ВСЕМ подписчикам topic — поддерживает
//     несколько пикеров на один магазин без потери сообщений.
package events

import (
	"sync"

	"github.com/google/uuid"
)

// Hub управляет SSE-каналами.
// Потокобезопасен: Subscribe/Unsubscribe/Notify можно вызывать из разных горутин.
type Hub struct {
	mu sync.RWMutex
	// topic → subscriberID → channel
	mp map[uuid.UUID]map[uuid.UUID]chan string
}

// NewHub создаёт новый Hub.
func NewHub() *Hub {
	return &Hub{
		mp: make(map[uuid.UUID]map[uuid.UUID]chan string),
	}
}

// Subscribe регистрирует SSE-соединение.
//
//   - topic: storeID для пикера, userID для клиента
//   - subscriberID: всегда userID
//
// Если для этого (topic, subscriberID) уже есть активный канал (переподключение) —
// он закрывается перед созданием нового, чтобы старая горутина не зависла.
func (h *Hub) Subscribe(topic uuid.UUID, subscriberID uuid.UUID) chan string {
	ch := make(chan string, 10)
	h.mu.Lock()
	if _, ok := h.mp[topic]; !ok {
		h.mp[topic] = make(map[uuid.UUID]chan string)
	}
	if old, ok := h.mp[topic][subscriberID]; ok {
		close(old)
	}
	h.mp[topic][subscriberID] = ch
	h.mu.Unlock()
	return ch
}

// Unsubscribe удаляет SSE-соединение и закрывает его канал.
func (h *Hub) Unsubscribe(topic uuid.UUID, subscriberID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	subs, ok := h.mp[topic]
	if !ok {
		return
	}
	if ch, ok := subs[subscriberID]; ok {
		close(ch)
		delete(subs, subscriberID)
	}
	if len(subs) == 0 {
		delete(h.mp, topic)
	}
}

// Notify отправляет сообщение всем подписчикам topic без блокировки.
// Если канал конкретного подписчика переполнен — его сообщение отбрасывается,
// остальные подписчики получают уведомление в штатном режиме.
func (h *Hub) Notify(topic uuid.UUID, message string) {
	h.mu.RLock()
	subs, ok := h.mp[topic]
	if !ok {
		h.mu.RUnlock()
		return
	}
	channels := make([]chan string, 0, len(subs))
	for _, ch := range subs {
		channels = append(channels, ch)
	}
	h.mu.RUnlock()

	for _, ch := range channels {
		select {
		case ch <- message:
		default:
		}
	}
}
