import Foundation

struct OrderItem: Codable, Identifiable {
    let id: UUID
    let orderId: UUID?
    let productId: UUID
    let quantity: Int
    let price: Double
}
