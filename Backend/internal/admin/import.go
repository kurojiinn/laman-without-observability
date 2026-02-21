package admin

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// ImportRawRow описывает сырую строку из файла импорта.
type ImportRawRow struct {
	RowNumber    int
	Name         string
	Price        float64
	Description  *string
	CategoryName string
	StoreName    string
}

// ImportProductRow — строка, готовая к вставке в БД.
type ImportProductRow struct {
	RowNumber   int
	Name        string
	Price       float64
	Description *string
	CategoryID  uuid.UUID
	StoreID     uuid.UUID
}

// parseImportFile читает Excel/CSV и возвращает подготовленные строки.
func parseImportFile(path string, ext string) ([]ImportRawRow, error) {
	switch ext {
	case ".xlsx", ".xlsm", ".xls":
		return parseExcel(path)
	case ".csv":
		return parseCSV(path)
	default:
		return nil, fmt.Errorf("неподдерживаемый формат файла: %s", filepath.Ext(path))
	}
}

// parseExcel читает первую таблицу Excel файла.
func parseExcel(path string) ([]ImportRawRow, error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return nil, fmt.Errorf("не удалось открыть Excel файл")
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("Excel файл не содержит листов")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("не удалось прочитать строки Excel")
	}

	return parseRows(rows)
}

// parseCSV читает CSV файл.
func parseCSV(path string) ([]ImportRawRow, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("не удалось открыть CSV файл")
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.Comma = detectCSVDelimiter(file)
	if _, err := file.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("не удалось прочитать CSV файл")
	}

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("не удалось прочитать CSV файл")
	}

	return parseRows(records)
}

// detectCSVDelimiter пытается определить разделитель CSV.
func detectCSVDelimiter(file *os.File) rune {
	buf := make([]byte, 1024)
	n, _ := file.Read(buf)
	sample := string(buf[:n])
	if strings.Count(sample, ";") > strings.Count(sample, ",") {
		return ';'
	}
	return ','
}

// parseRows нормализует строки из Excel/CSV.
func parseRows(rows [][]string) ([]ImportRawRow, error) {
	if len(rows) == 0 {
		return nil, fmt.Errorf("файл пустой")
	}

	start := 0
	if isHeaderRow(rows[0]) {
		start = 1
	}

	var result []ImportRawRow
	for i := start; i < len(rows); i++ {
		row := rows[i]
		rowNumber := i + 1
		if len(row) == 0 {
			continue
		}
		if len(row) < 5 {
			return nil, fmt.Errorf("недостаточно колонок в строке %d", rowNumber)
		}

		name := strings.TrimSpace(row[0])
		priceRaw := strings.TrimSpace(row[1])
		description := strings.TrimSpace(row[2])
		categoryName := strings.TrimSpace(row[3])
		storeName := strings.TrimSpace(row[4])

		if name == "" || priceRaw == "" || categoryName == "" || storeName == "" {
			return nil, fmt.Errorf("пустые обязательные поля в строке %d", rowNumber)
		}

		priceRaw = strings.ReplaceAll(priceRaw, ",", ".")
		price, err := strconv.ParseFloat(priceRaw, 64)
		if err != nil {
			return nil, fmt.Errorf("неверный формат цены в строке %d", rowNumber)
		}

		var descPtr *string
		if description != "" {
			descPtr = &description
		}

		result = append(result, ImportRawRow{
			RowNumber:    rowNumber,
			Name:         name,
			Price:        price,
			Description:  descPtr,
			CategoryName: categoryName,
			StoreName:    storeName,
		})
	}

	return result, nil
}

// isHeaderRow проверяет, является ли строка заголовком.
func isHeaderRow(row []string) bool {
	if len(row) < 2 {
		return false
	}
	header := strings.ToLower(strings.Join(row, " "))
	return strings.Contains(header, "название") || strings.Contains(header, "price") || strings.Contains(header, "категория")
}
