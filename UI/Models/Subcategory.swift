import Foundation

struct Subcategory: Codable, Identifiable {
    let id: UUID
    let categoryId: UUID
    let name: String
    let createdAt: Date?
}
