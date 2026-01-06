import Foundation
import Testing
@testable import Clawdbot

@Suite(.serialized) struct ConnectionModeResolverTests {
    private func makeDefaults() -> UserDefaults {
        UserDefaults(suiteName: "ConnectionModeResolverTests.\(UUID().uuidString)")!
    }

    @Test func configModeWinsOverDefaults() {
        let defaults = self.makeDefaults()
        defaults.set(AppState.ConnectionMode.local.rawValue, forKey: connectionModeKey)

        let root: [String: Any] = ["gateway": ["mode": "remote"]]
        let mode = ConnectionModeResolver.resolve(
            defaults: defaults,
            configRoot: root,
            configFileExists: true)

        #expect(mode == .remote)
    }

    @Test func remoteUrlWinsWhenNoMode() {
        let defaults = self.makeDefaults()
        defaults.set(AppState.ConnectionMode.local.rawValue, forKey: connectionModeKey)

        let root: [String: Any] = ["gateway": ["remote": ["url": "ws://host:18789"]]]
        let mode = ConnectionModeResolver.resolve(
            defaults: defaults,
            configRoot: root,
            configFileExists: true)

        #expect(mode == .remote)
    }

    @Test func storedModeUsedWhenNoConfig() {
        let defaults = self.makeDefaults()
        defaults.set(AppState.ConnectionMode.remote.rawValue, forKey: connectionModeKey)

        let mode = ConnectionModeResolver.resolve(
            defaults: defaults,
            configRoot: [:],
            configFileExists: false)

        #expect(mode == .remote)
    }

    @Test func configFileFallbackWhenDefaultsMissing() {
        let defaults = self.makeDefaults()
        defaults.set(false, forKey: "clawdbot.onboardingSeen")

        let mode = ConnectionModeResolver.resolve(
            defaults: defaults,
            configRoot: [:],
            configFileExists: true)

        #expect(mode == .local)
    }

    @Test func unconfiguredWhenNoConfigAndOnboardingUnseen() {
        let defaults = self.makeDefaults()
        defaults.set(false, forKey: "clawdbot.onboardingSeen")

        let mode = ConnectionModeResolver.resolve(
            defaults: defaults,
            configRoot: [:],
            configFileExists: false)

        #expect(mode == .unconfigured)
    }

    @Test func localWhenOnboardingSeenWithoutConfig() {
        let defaults = self.makeDefaults()
        defaults.set(true, forKey: "clawdbot.onboardingSeen")

        let mode = ConnectionModeResolver.resolve(
            defaults: defaults,
            configRoot: [:],
            configFileExists: false)

        #expect(mode == .local)
    }
}
