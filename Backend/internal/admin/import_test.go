package admin

import "testing"

func TestParseRows_Success(t *testing.T) {
	rows := [][]string{
		{"Название", "Цена", "Описание", "Категория", "Магазин"},
		{"Молоко 1л", "80", "Пастеризованное", "Продукты", "Додо Пицца"},
	}

	parsed, err := parseRows(rows)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(parsed) != 1 {
		t.Fatalf("expected 1 row, got %d", len(parsed))
	}
	if parsed[0].Name != "Молоко 1л" {
		t.Fatalf("unexpected name: %s", parsed[0].Name)
	}
	if parsed[0].Price != 80 {
		t.Fatalf("unexpected price: %f", parsed[0].Price)
	}
}

func TestParseRows_InvalidPrice(t *testing.T) {
	rows := [][]string{
		{"Название", "Цена", "Описание", "Категория", "Магазин"},
		{"Молоко", "abc", "desc", "Продукты", "Додо Пицца"},
	}

	_, err := parseRows(rows)
	if err == nil {
		t.Fatal("expected error for invalid price")
	}
}

func TestParseRows_MissingColumns(t *testing.T) {
	rows := [][]string{
		{"Название", "Цена", "Описание", "Категория", "Магазин"},
		{"Молоко", "80"},
	}

	_, err := parseRows(rows)
	if err == nil {
		t.Fatal("expected error for missing columns")
	}
}
