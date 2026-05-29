import Foundation
import Combine

@MainActor
final class ChoreStore: ObservableObject {
    @Published private(set) var chores: [Chore] = []
    private let defaults: UserDefaults
    private let key = "cached_chores"
    private let client = SupabaseClient()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: key),
           let cached = try? JSONDecoder().decode([Chore].self, from: data) {
            chores = cached
        }
    }

    func cache(_ list: [Chore]) {
        chores = list
        if let data = try? JSONEncoder().encode(list) {
            defaults.set(data, forKey: key)
        }
    }

    func refresh() async {
        if let fresh = try? await client.fetchChores() { cache(fresh) }
    }

    func addChore(_ label: String) async {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        try? await client.addChore(label: trimmed)
        await refresh()
    }
}
