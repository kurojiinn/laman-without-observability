import Foundation

struct Store: Codable, Identifiable {
    let id: UUID
    let name: String
    let address: String?
    let phone: String?
    let description: String?
    let imageUrl: String?
    let rating: Double
    let categoryType: StoreCategoryType
}

enum StoreCategoryType: String, Codable, CaseIterable, Identifiable {
    case food = "FOOD"
    case clothes = "CLOTHES"
    case building = "BUILDING"
    case home = "HOME"
    case pharmacy = "PHARMACY"
    case auto = "AUTO"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .food: return "🍔 Общепит"
        case .clothes: return "👕 Одежда"
        case .building: return "🏗️ Стройка"
        case .home: return "🏠 Быт"
        case .pharmacy: return "💊 Аптека"
        case .auto: return "🚗 Авто"
        }
    }

    static var visibleCases: [StoreCategoryType] {
        [.food, .clothes, .home, .building, .pharmacy]
    }
}
