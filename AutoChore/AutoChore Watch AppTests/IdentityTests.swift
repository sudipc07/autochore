import XCTest
@testable import AutoChore_Watch_App

final class IdentityTests: XCTestCase {
    func test_randomFourAreUniqueAndFromPool() {
        let four = CharacterNames.randomFour()
        XCTAssertEqual(four.count, 4)
        XCTAssertEqual(Set(four).count, 4)                       // unique
        XCTAssertTrue(four.allSatisfy { CharacterNames.pool.contains($0) })
    }

    func test_saveAndLoadLocksName() {
        let suite = "IdentityTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        let id = UserIdentity(defaults: defaults)
        XCTAssertNil(id.name)
        id.save("Wobble")
        XCTAssertEqual(id.name, "Wobble")

        // A fresh instance reads the locked value back from storage.
        let reloaded = UserIdentity(defaults: defaults)
        XCTAssertEqual(reloaded.name, "Wobble")
    }
}
