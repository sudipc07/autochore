import XCTest
@testable import AutoChore_Watch_App

final class ChoreTests: XCTestCase {
    func test_decodesFromSupabaseJSON() throws {
        let json = """
        [{"id":"a","label":"Mop","sort_order":10},
         {"id":"b","label":"Vacuum","sort_order":20}]
        """.data(using: .utf8)!
        let chores = try JSONDecoder().decode([Chore].self, from: json)
        XCTAssertEqual(chores.count, 2)
        XCTAssertEqual(chores[0].label, "Mop")
        XCTAssertEqual(chores[1].sortOrder, 20)
    }

    func test_encodesNewChoreWithoutId() throws {
        let chore = Chore(id: nil, label: "Windows", sortOrder: 100)
        let data = try JSONEncoder().encode(chore)
        let str = String(data: data, encoding: .utf8)!
        XCTAssertTrue(str.contains("\"label\":\"Windows\""))
        XCTAssertFalse(str.contains("\"id\""))   // nil id omitted for insert
    }
}
