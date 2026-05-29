import XCTest
@testable import AutoChore_Watch_App

final class SessionTests: XCTestCase {
    func test_encodesPayloadWithSnakeCaseKeys() throws {
        let session = Session(
            userId: "Goofy",
            choreLabel: "Mop",
            startTime: Date(timeIntervalSince1970: 0),
            endTime: Date(timeIntervalSince1970: 5),
            sampleRate: 50,
            notes: "test",
            motionSamples: [MotionSample(t: 0, ax: 1, ay: 2, az: 3,
                                         gx: 4, gy: 5, gz: 6,
                                         mx: 7, my: 8, mz: 9)],
            altitudeSamples: [AltitudeSample(t: 0, relativeAltitude: 1.5)],
            floorSummary: FloorSummary(floorsAscended: 2, floorsDescended: 1)
        )
        let data = try JSONEncoder().encode(session)
        let obj = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(obj["user_id"] as? String, "Goofy")
        XCTAssertEqual(obj["chore_label"] as? String, "Mop")
        XCTAssertEqual(obj["sample_count"] as? Int, 1)   // derived
        XCTAssertNotNil(obj["motion_samples"])
        XCTAssertNotNil(obj["floor_summary"])
    }

    func test_roundTripsThroughDiskCodable() throws {
        let s = Session(userId: "A", choreLabel: "Cook",
                        startTime: Date(), endTime: Date(),
                        sampleRate: 50, notes: nil,
                        motionSamples: [], altitudeSamples: [],
                        floorSummary: FloorSummary(floorsAscended: 0, floorsDescended: 0))
        let data = try JSONEncoder().encode(s)
        let decoded = try JSONDecoder().decode(Session.self, from: data)
        XCTAssertEqual(decoded.choreLabel, "Cook")
    }
}
