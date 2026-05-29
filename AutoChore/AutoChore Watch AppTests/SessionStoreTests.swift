import XCTest
@testable import AutoChore_Watch_App

final class SessionStoreTests: XCTestCase {
    var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    private func makeSession() -> Session {
        Session(userId: "A", choreLabel: "Mop", startTime: Date(), endTime: Date(),
                sampleRate: 50, notes: nil, motionSamples: [],
                altitudeSamples: [], floorSummary: .init(floorsAscended: 0, floorsDescended: 0))
    }

    func test_savesAndLoadsPending() throws {
        let store = SessionStore(directory: dir)
        try store.save(makeSession())
        XCTAssertEqual(store.loadPending().count, 1)
    }

    func test_removeDeletesFromDisk() throws {
        let store = SessionStore(directory: dir)
        let id = try store.save(makeSession())
        store.remove(id)
        XCTAssertEqual(store.loadPending().count, 0)
    }
}
