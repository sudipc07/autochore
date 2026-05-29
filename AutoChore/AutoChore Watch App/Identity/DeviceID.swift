import Foundation
import WatchKit

/// A stable identifier for this Watch, used to key the devices table.
enum DeviceID {
    static var current: String {
        if let id = WKInterfaceDevice.current().identifierForVendor?.uuidString {
            return id
        }
        // Fallback: persist a generated id if identifierForVendor is unavailable.
        let key = "fallback_device_id"
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: key) { return existing }
        let new = UUID().uuidString
        defaults.set(new, forKey: key)
        return new
    }
}
