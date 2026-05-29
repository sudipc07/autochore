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

    func postSession(_ session: Session) async throws {
        var req = request("sessions", method: "POST")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(session)
        let (_, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
    }

    private func check(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse else { return }
        guard (200...299).contains(http.statusCode) else {
            throw SupabaseError.badStatus(http.statusCode)
        }
    }
}
