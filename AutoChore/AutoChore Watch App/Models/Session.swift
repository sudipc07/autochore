import Foundation

struct MotionSample: Codable {
    let t: Int                      // ms offset from start
    let ax, ay, az: Double          // user acceleration (gravity removed), g
    let gravx, gravy, gravz: Double // gravity vector, g
    let gx, gy, gz: Double          // rotation rate (gyroscope), rad/s
    let roll, pitch, yaw: Double    // attitude (Euler), radians
    let qw, qx, qy, qz: Double      // attitude quaternion
    let mx, my, mz: Double?         // calibrated magnetic field, µT (nil if uncalibrated)
    let magacc: Int                 // mag accuracy: -1 uncalibrated, 0 low, 1 med, 2 high
    let heading: Double?            // heading, degrees (nil if unavailable)
}

struct AltitudeSample: Codable {
    let t: Int
    let relativeAltitude: Double
    enum CodingKeys: String, CodingKey {
        case t
        case relativeAltitude = "relative_altitude"
    }
}

struct FloorSummary: Codable {
    let floorsAscended: Int
    let floorsDescended: Int
    enum CodingKeys: String, CodingKey {
        case floorsAscended = "floors_ascended"
        case floorsDescended = "floors_descended"
    }
}

struct Session: Codable {
    let userId: String
    let choreLabel: String
    let startTime: Date
    let endTime: Date
    let sampleRate: Int
    let notes: String?
    let motionSamples: [MotionSample]
    let altitudeSamples: [AltitudeSample]
    let floorSummary: FloorSummary

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case choreLabel = "chore_label"
        case startTime = "start_time"
        case endTime = "end_time"
        case sampleRate = "sample_rate"
        case sampleCount = "sample_count"
        case notes
        case motionSamples = "motion_samples"
        case altitudeSamples = "altitude_samples"
        case floorSummary = "floor_summary"
    }

    init(userId: String, choreLabel: String, startTime: Date, endTime: Date,
         sampleRate: Int, notes: String?, motionSamples: [MotionSample],
         altitudeSamples: [AltitudeSample], floorSummary: FloorSummary) {
        self.userId = userId; self.choreLabel = choreLabel
        self.startTime = startTime; self.endTime = endTime
        self.sampleRate = sampleRate; self.notes = notes
        self.motionSamples = motionSamples; self.altitudeSamples = altitudeSamples
        self.floorSummary = floorSummary
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(userId, forKey: .userId)
        try c.encode(choreLabel, forKey: .choreLabel)
        try c.encode(Self.iso(startTime), forKey: .startTime)
        try c.encode(Self.iso(endTime), forKey: .endTime)
        try c.encode(sampleRate, forKey: .sampleRate)
        try c.encode(motionSamples.count, forKey: .sampleCount)
        try c.encodeIfPresent(notes, forKey: .notes)
        try c.encode(motionSamples, forKey: .motionSamples)
        try c.encode(altitudeSamples, forKey: .altitudeSamples)
        try c.encode(floorSummary, forKey: .floorSummary)
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = try c.decode(String.self, forKey: .userId)
        choreLabel = try c.decode(String.self, forKey: .choreLabel)
        startTime = Self.isoDate(try c.decode(String.self, forKey: .startTime))
        endTime = Self.isoDate(try c.decode(String.self, forKey: .endTime))
        sampleRate = try c.decode(Int.self, forKey: .sampleRate)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        motionSamples = try c.decode([MotionSample].self, forKey: .motionSamples)
        altitudeSamples = try c.decode([AltitudeSample].self, forKey: .altitudeSamples)
        floorSummary = try c.decode(FloorSummary.self, forKey: .floorSummary)
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static func iso(_ d: Date) -> String { isoFormatter.string(from: d) }
    private static func isoDate(_ s: String) -> Date { isoFormatter.date(from: s) ?? Date() }
}
