import Foundation

enum SupabaseError: Error { case badStatus(Int) }

struct SupabaseClient {
    let baseURL = Config.supabaseURL
    let key = Config.supabaseKey

    private func request(_ path: String, query: String? = nil, method: String) -> URLRequest {
        var url = baseURL
            .appendingPathComponent("rest/v1")
            .appendingPathComponent(path)
        if let query, var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            comps.query = query
            url = comps.url ?? url
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(key, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    func fetchChores() async throws -> [Chore] {
        let req = request("chores", query: "select=id,label,sort_order&order=sort_order", method: "GET")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
        return try JSONDecoder().decode([Chore].self, from: data)
    }

    func addChore(label: String) async throws {
        var req = request("chores", method: "POST")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(Chore(id: nil, label: label, sortOrder: 100))
        let (_, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
    }

    func fetchTakenNames() async throws -> [String] {
        let req = request("devices", query: "select=name", method: "GET")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
        struct Row: Decodable { let name: String }
        return try JSONDecoder().decode([Row].self, from: data).map(\.name)
    }

    func registerDevice(deviceId: String, name: String) async throws {
        var req = request("devices", query: "on_conflict=device_id", method: "POST")
        req.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        struct Body: Encodable { let device_id: String; let name: String }
        req.httpBody = try JSONEncoder().encode(Body(device_id: deviceId, name: name))
        let (_, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
    }

    /// Upload a session: raw samples go to Storage as a file, metadata + the
    /// file path go to the `sessions` table. Keeps the row tiny so sessions of
    /// any length upload reliably.
    func uploadSession(_ session: Session) async throws {
        let path = "\(UUID().uuidString).json"
        try await uploadSamplesFile(path: path, session: session)
        try await insertSessionRow(session, samplesPath: path)
    }

    private func uploadSamplesFile(path: String, session: Session) async throws {
        let url = baseURL.appendingPathComponent("storage/v1/object/\(Self.bucket)/\(path)")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(key, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("true", forHTTPHeaderField: "x-upsert")
        struct Raw: Encodable {
            let motion_samples: [MotionSample]
            let altitude_samples: [AltitudeSample]
        }
        let body = try JSONEncoder().encode(
            Raw(motion_samples: session.motionSamples, altitude_samples: session.altitudeSamples))
        let (_, resp) = try await URLSession.shared.upload(for: req, from: body)
        try check(resp)
    }

    private func insertSessionRow(_ session: Session, samplesPath: String) async throws {
        var req = request("sessions", method: "POST")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        struct Meta: Encodable {
            let user_id: String
            let chore_label: String
            let start_time: String
            let end_time: String
            let sample_rate: Int
            let sample_count: Int
            let notes: String?
            let floor_summary: FloorSummary
            let samples_path: String
        }
        let meta = Meta(
            user_id: session.userId,
            chore_label: session.choreLabel,
            start_time: Self.iso(session.startTime),
            end_time: Self.iso(session.endTime),
            sample_rate: session.sampleRate,
            sample_count: session.motionSamples.count,
            notes: session.notes,
            floor_summary: session.floorSummary,
            samples_path: samplesPath)
        req.httpBody = try JSONEncoder().encode(meta)
        let (_, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
    }

    private static let bucket = "raw-sessions"

    private static let iso: (Date) -> String = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return { f.string(from: $0) }
    }()

    private func check(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse else { return }
        guard (200...299).contains(http.statusCode) else {
            throw SupabaseError.badStatus(http.statusCode)
        }
    }
}
