import Capacitor
import UIKit

/// The app's bridge view controller (Main.storyboard): registers the plugins that live in
/// the app target itself rather than in a Swift package.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
