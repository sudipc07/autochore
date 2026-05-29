import Foundation

struct Chore: Codable, Identifiable, Hashable {
    let id: String?
    let label: String
    let sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case sortOrder = "sort_order"
    }

    init(id: String?, label: String, sortOrder: Int) {
        self.id = id
        self.label = label
        self.sortOrder = sortOrder
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        label = try c.decode(String.self, forKey: .label)
        sortOrder = try c.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 100
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let id { try c.encode(id, forKey: .id) }
        try c.encode(label, forKey: .label)
        try c.encode(sortOrder, forKey: .sortOrder)
    }
}
