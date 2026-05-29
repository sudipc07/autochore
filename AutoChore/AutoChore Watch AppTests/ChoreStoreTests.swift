import XCTest
@testable import AutoChore_Watch_App

@MainActor
final class ChoreStoreTests: XCTestCase {
    func test_cachesAndReloadsLabels() {
        let suite = "ChoreStoreTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = ChoreStore(defaults: defaults)
        store.cache([Chore(id: "1", label: "Mop", sortOrder: 10),
                     Chore(id: "2", label: "Dust", sortOrder: 40)])

        let reloaded = ChoreStore(defaults: defaults)
        XCTAssertEqual(reloaded.chores.map(\.label), ["Mop", "Dust"])
    }
}
