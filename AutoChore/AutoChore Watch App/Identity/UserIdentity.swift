import Foundation
import Combine

final class UserIdentity: ObservableObject {
    private let key = "character_name"
    private let defaults: UserDefaults
    @Published private(set) var name: String?

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.name = defaults.string(forKey: key)
    }

    func save(_ value: String) {
        defaults.set(value, forKey: key)
        name = value
    }
}
