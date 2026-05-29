import Foundation

enum CharacterNames {
    // Original funny names — no trademarked characters.
    static let pool = [
        "Goober", "Bonkers", "Ziggy", "Waffles", "Pickles", "Noodle",
        "Gizmo", "Tater", "Biscuit", "Doofus", "Wiggles", "Snorkel",
        "Bingo", "Mojo", "Pixel", "Turbo"
    ]
    static func randomFour() -> [String] {
        Array(pool.shuffled().prefix(4))
    }
}
