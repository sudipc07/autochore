import Foundation

struct PendingSession: Codable {
    let id: String
    let session: Session
}

final class SessionStore {
    private let directory: URL
    private let fm = FileManager.default

    init(directory: URL? = nil) {
        if let directory {
            self.directory = directory
        } else {
            let base = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
            self.directory = base.appendingPathComponent("pending_sessions")
        }
        try? fm.createDirectory(at: self.directory, withIntermediateDirectories: true)
    }

    @discardableResult
    func save(_ session: Session) throws -> String {
        let id = UUID().uuidString
        let url = directory.appendingPathComponent("\(id).json")
        try JSONEncoder().encode(PendingSession(id: id, session: session)).write(to: url)
        return id
    }

    func loadPending() -> [PendingSession] {
        let files = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(PendingSession.self, from: Data(contentsOf: $0)) }
    }

    func remove(_ id: String) {
        try? fm.removeItem(at: directory.appendingPathComponent("\(id).json"))
    }
}
