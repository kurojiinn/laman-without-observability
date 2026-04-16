// Package events реализует SSE (Server-Sent Events) Hub —
// механизм доставки real-time уведомлений сборщикам (picker) по магазинам.
//
// Архитектура:
//   - Каждый магазин (storeID) имеет один активный канал.
//   - Picker при подключении вызывает Subscribe — получает канал для чтения.
//   - При отключении вызывает Unsubscribe — канал закрывается.
//   - Бизнес-логика вызывает Notify — сообщение кладётся в канал без блокировки.
package events

import (
	"sync"

	"github.com/google/uuid"
)

// Hub управляет SSE-каналами для магазинов.
// Потокобезопасен: Subscribe/Unsubscribe/Notify можно вызывать из разных горутин.
type Hub struct {
	mp map[uuid.UUID]chan string
	mu sync.RWMutex
}

// NewHub создаёт новый Hub.
func NewHub() *Hub {
	return &Hub{
		mp: make(map[uuid.UUID]chan string),
	}
}

// Subscribe регистрирует SSE-соединение для магазина и возвращает канал для чтения событий.
// Если для этого storeID уже есть активный канал (предыдущее соединение) —
// он закрывается перед созданием нового, чтобы горутина старого клиента не зависла.
//
// Вызывать из SSE-хендлера при открытии соединения.
func (h *Hub) Subscribe(storeID uuid.UUID) chan string {
	ch := make(chan string, 10)
	h.mu.Lock()
	// Закрываем старый канал если есть — без этого горутина читающая из него
	// заблокируется навечно (канал никогда не закроется и новых данных не придёт).
	if old, ok := h.mp[storeID]; ok {
		close(old)
	}
	h.mp[storeID] = ch
	h.mu.Unlock()
	return ch
}

// Unsubscribe удаляет SSE-соединение для магазина и закрывает его канал.
// Закрытие канала — сигнал для читающей горутины завершить работу.
//
// Вызывать при закрытии SSE-соединения (disconnect клиента или таймаут).
func (h *Hub) Unsubscribe(storeID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if ch, ok := h.mp[storeID]; ok {
		close(ch)
		delete(h.mp, storeID)
	}
}

// Notify отправляет сообщение в канал магазина без блокировки.
// Если канала нет (клиент не подключён) — сообщение молча отбрасывается.
// Если буфер канала переполнен (клиент слишком медленный или завис) —
// сообщение тоже отбрасывается, чтобы не блокировать вызывающую горутину.
//
// Важно: select/default гарантирует non-blocking запись. Без этого
// один тупящий SSE-клиент заблокировал бы уведомления для всего магазина навсегда.
func (h *Hub) Notify(storeID uuid.UUID, message string) {
	h.mu.RLock()
	ch, ok := h.mp[storeID]
	h.mu.RUnlock()

	if !ok {
		return
	}

	// Non-blocking send: если буфер полон — клиент слишком медленный,
	// пропускаем сообщение, не блокируем текущую горутину.
	select {
	case ch <- message:
	default:
	}
}
