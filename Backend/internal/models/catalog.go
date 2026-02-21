package models

import (
	"time"

	"github.com/google/uuid"
)

// Category представляет категорию товара.
type Category struct {
	ID          uuid.UUID `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description *string   `db:"description" json:"description,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// Product представляет товар в каталоге.
type Product struct {
	ID            uuid.UUID  `db:"id" json:"id"`
	CategoryID    uuid.UUID  `db:"category_id" json:"category_id"`
	SubcategoryID *uuid.UUID `db:"subcategory_id" json:"subcategory_id,omitempty"`
	StoreID       uuid.UUID  `db:"store_id" json:"store_id"`
	Name          string     `db:"name" json:"name"`
	Description   *string    `db:"description" json:"description,omitempty"`
	ImageURL      *string    `db:"image_url" json:"image_url,omitempty"`
	Price         float64    `db:"price" json:"price"`
	Weight        *float64   `db:"weight" json:"weight,omitempty"`
	IsAvailable   bool       `db:"is_available" json:"is_available"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

// Subcategory представляет подкатегорию товаров.
type Subcategory struct {
	ID         uuid.UUID `db:"id" json:"id"`
	CategoryID uuid.UUID `db:"category_id" json:"category_id"`
	Name       string    `db:"name" json:"name"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

// Store представляет магазин, где можно приобрести товары.
type Store struct {
	ID           uuid.UUID         `db:"id" json:"id"`
	Name         string            `db:"name" json:"name"`
	Address      string            `db:"address" json:"address"`
	Phone        *string           `db:"phone" json:"phone,omitempty"`
	Description  *string           `db:"description" json:"description,omitempty"`
	ImageURL     *string           `db:"image_url" json:"image_url,omitempty"`
	Rating       float64           `db:"rating" json:"rating"`
	CategoryType StoreCategoryType `db:"category_type" json:"category_type"`
	CreatedAt    time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time         `db:"updated_at" json:"updated_at"`
}

// StoreCategoryType представляет тип магазина.
type StoreCategoryType string

const (
	StoreCategoryFood     StoreCategoryType = "FOOD"
	StoreCategoryClothes  StoreCategoryType = "CLOTHES"
	StoreCategoryBuilding StoreCategoryType = "BUILDING"
	StoreCategoryAuto     StoreCategoryType = "AUTO"
	StoreCategoryHome     StoreCategoryType = "HOME"
	StoreCategoryPharmacy StoreCategoryType = "PHARMACY"
)
