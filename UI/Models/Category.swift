import Foundation

struct Category: Codable, Identifiable {
    let id: UUID
    let name: String
    let description: String?
    let createdAt: Date?
}
