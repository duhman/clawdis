import Foundation

enum ConnectionModeResolver {
    static func resolve(
        defaults: UserDefaults = .standard,
        configRoot: [String: Any]? = nil,
        configFileExists: Bool? = nil
    ) -> AppState.ConnectionMode {
        let configExists = configFileExists ?? FileManager.default
            .fileExists(atPath: ClawdbotConfigFile.url().path)
        let root = configRoot ?? (configExists ? ClawdbotConfigFile.loadDict() : [:])
        let gateway = root["gateway"] as? [String: Any]
        let configModeRaw = (gateway?["mode"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let configMode: AppState.ConnectionMode? = switch configModeRaw {
        case "local":
            .local
        case "remote":
            .remote
        case "unconfigured":
            .unconfigured
        default:
            nil
        }
        let remoteUrl = (gateway?["remote"] as? [String: Any])?["url"] as? String
        let hasRemoteUrl = !(remoteUrl?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .isEmpty ?? true)

        if let configMode {
            return configMode
        }
        if hasRemoteUrl {
            return .remote
        }
        if let storedMode = defaults.string(forKey: connectionModeKey) {
            return AppState.ConnectionMode(rawValue: storedMode) ?? .local
        }
        if configExists {
            return .local
        }

        let seen = defaults.bool(forKey: "clawdbot.onboardingSeen")
        return seen ? .local : .unconfigured
    }
}
