import Capacitor
import GameKit
import UIKit

/// Game Center for the web layer (src/platform/capacitor.ts → registerPlugin('GameCenter')):
/// sign-in, achievements (ids "kb.<in-game id>"), the career-goals leaderboard and the dashboard.
/// Every call resolves even when the player is not signed in: Game Center stays optional.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showDashboard", returnType: CAPPluginReturnPromise),
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            if player.isAuthenticated {
                call.resolve(["signedIn": true])
                return
            }
            var answered = false
            player.authenticateHandler = { [weak self] viewController, _ in
                if let vc = viewController {
                    self?.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                if !answered {
                    answered = true
                    call.resolve(["signedIn": GKLocalPlayer.local.isAuthenticated])
                }
            }
        }
    }

    @objc func unlock(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["ok": false])
            return
        }
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = 100
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            call.resolve(["ok": error == nil])
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let board = call.getString("leaderboard"), let score = call.getInt("score"), GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["ok": false])
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [board]) { error in
            call.resolve(["ok": error == nil])
        }
    }

    @objc func showDashboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else {
                call.resolve(["ok": false])
                return
            }
            let vc = GKGameCenterViewController(state: .default)
            vc.gameCenterDelegate = GameCenterDismisser.shared
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve(["ok": true])
        }
    }
}

final class GameCenterDismisser: NSObject, GKGameCenterControllerDelegate {
    static let shared = GameCenterDismisser()
    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
