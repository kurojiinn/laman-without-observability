package models

// Page содержит параметры пагинации, разобранные из query-string.
// Используется handler'ами как параметр для service.
type Page struct {
	Limit  int // сколько записей вернуть (после нормализации)
	Offset int // сколько пропустить
	Page   int // номер страницы (1-based, для построения ответа)
}

// HasMore возвращает true если есть следующая страница.
func (p Page) HasMore(total int) bool {
	return p.Offset+p.Limit < total
}

// PaginatedResponse — стандартный формат ответа списочных эндпоинтов.
// Поле Data сделано generic чтобы переиспользовать структуру для разных типов.
//
// Формат:
//
//	{
//	  "data":  [...],     // элементы текущей страницы
//	  "total": 250,       // всего записей с учётом фильтров
//	  "page":  3,         // текущая страница (1-based)
//	  "limit": 20,        // размер страницы
//	  "has_more": true    // есть ли следующая страница
//	}
type PaginatedResponse[T any] struct {
	Data    []T  `json:"data"`
	Total   int  `json:"total"`
	Page    int  `json:"page"`
	Limit   int  `json:"limit"`
	HasMore bool `json:"has_more"`
}

// NewPaginatedResponse строит ответ из коллекции и параметров.
// Гарантирует что Data — не nil (фронту легче — `arr.length` вместо `arr?.length`).
func NewPaginatedResponse[T any](data []T, total int, page Page) PaginatedResponse[T] {
	if data == nil {
		data = []T{}
	}
	return PaginatedResponse[T]{
		Data:    data,
		Total:   total,
		Page:    page.Page,
		Limit:   page.Limit,
		HasMore: page.HasMore(total),
	}
}

// NormalizePage парсит limit/offset с границами.
// Дефолты: limit=20, offset=0. Maximum limit — 100 (защита от DoS).
func NormalizePage(limit, offset int) Page {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	return Page{
		Limit:  limit,
		Offset: offset,
		Page:   offset/limit + 1,
	}
}
