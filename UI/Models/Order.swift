import Foundation

struct Order: Codable, Identifiable {
    let id: UUID
    let guestName: String?
    let guestPhone: String?
    let guestAddress: String?
    let comment: String?
    let status: String?
    let paymentMethod: PaymentMethod?
    let itemsTotal: Double?
    let serviceFee: Double?
    let deliveryFee: Double?
    let finalTotal: Double?
    let createdAt: Date?
    let items: [OrderItem]?
}

extension Order {
    func withStatus(_ status: String) -> Order {
        Order(
            id: id,
            guestName: guestName,
            guestPhone: guestPhone,
            guestAddress: guestAddress,
            comment: comment,
            status: status,
            paymentMethod: paymentMethod,
            itemsTotal: itemsTotal,
            serviceFee: serviceFee,
            deliveryFee: deliveryFee,
            finalTotal: finalTotal,
            createdAt: createdAt,
            items: items
        )
    }
}

struct CreateOrderRequest: Codable {
    let guestName: String
    let guestPhone: String
    let guestAddress: String
    let deliveryAddress: String
    let comment: String?
    let paymentMethod: PaymentMethod
    let storeId: UUID
    let items: [CreateOrderItem]
}

struct CreateOrderItem: Codable {
    let productId: UUID
    let quantity: Int
}

enum PaymentMethod: String, Codable {
    case cash = "CASH"
    case transfer = "TRANSFER"
}
