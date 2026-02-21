import Foundation
import Combine

@MainActor
final class CatalogViewModel: ObservableObject {
    @Published var categories: [Category] = []
    @Published var subcategories: [Subcategory] = []
    @Published var products: [Product] = []
    @Published var selectedCategoryId: UUID? = nil
    @Published var selectedSubcategoryId: UUID? = nil
    @Published var searchText: String = ""
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    private let api = LamanAPI()
    private let appState: AppState
    private var searchTask: Task<Void, Never>?

    init(appState: AppState) {
        self.appState = appState
    }

    func loadInitial() async {
        isLoading = true
        errorMessage = nil
        do {
            categories = try await api.getCategories()
            products = try await api.getProducts(categoryId: nil, subcategoryId: nil, search: nil)
            appState.mergeProducts(products)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func selectCategory(_ id: UUID?) async {
        selectedCategoryId = id
        selectedSubcategoryId = nil
        subcategories = []
        await loadSubcategories(for: id)
        await applyFilters()
    }

    func selectSubcategory(_ id: UUID?) async {
        selectedSubcategoryId = id
        await applyFilters()
    }

    func searchTextChanged(_ text: String) {
        searchText = text
        scheduleSearch()
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)

        // Debounce поиска, чтобы не дергать API на каждый символ.
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard let self, !Task.isCancelled else { return }
            await self.applyFilters(search: query.isEmpty ? nil : query)
        }
    }

    private func loadSubcategories(for categoryId: UUID?) async {
        guard let categoryId else {
            subcategories = []
            return
        }
        subcategories = []
        do {
            subcategories = try await api.getSubcategories(categoryId: categoryId)
        } catch {
            subcategories = []
            errorMessage = error.localizedDescription
        }
    }

    // Фильтрация учитывает выбранную категорию, подкатегорию и поисковый текст.
    private func applyFilters(search: String? = nil) async {
        isLoading = true
        errorMessage = nil
        do {
            let effectiveSearch = search ?? (searchText.isEmpty ? nil : searchText)
            let shouldIgnoreCategory = !(effectiveSearch?.isEmpty ?? true)
            products = try await api.getProducts(
                categoryId: shouldIgnoreCategory ? nil : selectedCategoryId,
                subcategoryId: shouldIgnoreCategory ? nil : selectedSubcategoryId,
                search: effectiveSearch
            )
            appState.mergeProducts(products)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
