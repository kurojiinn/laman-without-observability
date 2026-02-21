import Foundation

struct Product: Codable, Identifiable {
    let id: UUID
    let categoryId: UUID?
    let subcategoryId: UUID?
    let storeId: UUID
    let name: String
    let description: String?
    let price: Double
    let weight: Double?
    let isAvailable: Bool
}
