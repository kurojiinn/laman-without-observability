import SwiftUI

struct CourierOrdersHistoryView: View {
    @ObservedObject var viewModel: CourierViewModel

    var body: some View {
        List(viewModel.allOrders) { order in
            HStack {
                Text("#\(String(order.id.uuidString.prefix(8)))")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                Text(order.status ?? "UNKNOWN")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor(for: order.status).opacity(0.2))
                    .foregroundColor(statusColor(for: order.status))
                    .clipShape(Capsule())
            }
            .padding(.vertical, 4)
        }
        .listStyle(.plain)
    }

    private func statusColor(for status: String?) -> Color {
        switch status {
        case "DELIVERED":
            return .green
        case "IN_PROGRESS":
            return .yellow
        case "CONFIRMED":
            return .blue
        default:
            return .gray
        }
    }
}
