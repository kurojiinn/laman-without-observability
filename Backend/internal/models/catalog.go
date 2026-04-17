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
	City         string            `db:"city" json:"city"`
	Phone        *string           `db:"phone" json:"phone,omitempty"`
	Description  *string           `db:"description" json:"description,omitempty"`
	ImageURL     *string           `db:"image_url" json:"image_url,omitempty"`
	Rating       float64           `db:"rating" json:"rating"`
	CategoryType StoreCategoryType `db:"category_type" json:"category_type"`
	OpensAt      *string           `db:"opens_at" json:"opens_at,omitempty"`
	ClosesAt     *string           `db:"closes_at" json:"closes_at,omitempty"`
	CreatedAt    time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time         `db:"updated_at" json:"updated_at"`
	Lat          *float64          `db:"lat" json:"lat,omitempty"`
	Lng          *float64          `db:"lng" json:"lng,omitempty"`
}

// Review представляет отзыв покупателя о магазине.
type Review struct {
	ID        uuid.UUID `db:"id" json:"id"`
	StoreID   uuid.UUID `db:"store_id" json:"store_id"`
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	UserPhone string    `db:"user_phone" json:"user_phone"`
	Rating    int       `db:"rating" json:"rating"`
	Comment   string    `db:"comment" json:"comment"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// FeaturedBlockType — тип блока витрины на главном экране.
type FeaturedBlockType string

const (
	FeaturedBlockNewItems   FeaturedBlockType = "new_items"
	FeaturedBlockHits       FeaturedBlockType = "hits"
	FeaturedBlockMovieNight FeaturedBlockType = "movie_night"
	FeaturedBlockQuickSnack FeaturedBlockType = "quick_snack"
	FeaturedBlockLazyCook   FeaturedBlockType = "lazy_cook"
)

// Recipe — рецепт блюда с набором ингредиентов.
type Recipe struct {
	ID          uuid.UUID  `db:"id"          json:"id"`
	StoreID     *uuid.UUID `db:"store_id"    json:"store_id,omitempty"`
	Name        string     `db:"name"        json:"name"`
	Description *string    `db:"description" json:"description,omitempty"`
	ImageURL    *string    `db:"image_url"   json:"image_url,omitempty"`
	Position    int        `db:"position"    json:"position"`
	CreatedAt   time.Time  `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at"  json:"updated_at"`
}

// RecipeWithProducts — рецепт вместе с его ингредиентами.
type RecipeWithProducts struct {
	Recipe
	Products []RecipeIngredient `json:"products"`
}

// RecipeIngredient — ингредиент рецепта (товар + количество).
type RecipeIngredient struct {
	Product
	Quantity int `db:"quantity" json:"quantity"`
}

// FeaturedProduct связывает товар с блоком витрины.
type FeaturedProduct struct {
	ID        uuid.UUID         `db:"id"         json:"id"`
	ProductID uuid.UUID         `db:"product_id" json:"product_id"`
	BlockType FeaturedBlockType `db:"block_type" json:"block_type"`
	Position  int               `db:"position"   json:"position"`
	CreatedAt time.Time         `db:"created_at" json:"created_at"`
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
