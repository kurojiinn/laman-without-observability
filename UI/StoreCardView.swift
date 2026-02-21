import SwiftUI
import Foundation

struct StoreCardView: View {
    let store: Store

    private let accentBlue = Color(red: 0.23, green: 0.51, blue: 0.96)

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(accentBlue.opacity(0.2))
                    .frame(width: 56, height: 56)
                Text(store.name.prefix(1))
                    .font(.title2)
                    .foregroundStyle(accentBlue)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(store.name)
                    .font(.headline)
                if let desc = store.description, !desc.isEmpty {
                    Text(desc)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 6) {
                    Image(systemName: "star.fill")
                        .font(.caption)
                        .foregroundStyle(.yellow)
                    Text(String(format: "%.1f", store.rating))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(.vertical, 6)
    }
}

#Preview {
    let appState = CartViewModel()
    StoreCardView(store: Store(
        id: UUID(),
        name: "Додо Пицца",
        address: "Грозный, пр. Мира 12",
        phone: "+7 (999) 101-01-01",
        description: "Пицца и напитки",
        imageUrl: nil,
        rating: 4.7,
        categoryType: .food
    ))
    .padding()
    .environmentObject(appState)
    .environmentObject(CatalogViewModel(appState: appState))
    .environmentObject(StoresViewModel())
}
