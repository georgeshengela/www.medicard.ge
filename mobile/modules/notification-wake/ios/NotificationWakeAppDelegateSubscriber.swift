import ExpoModulesCore
import ExpoNotifications
import UIKit

public class NotificationWakeAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // At launch, before iOS delivers the button response that launched the app in the background.
    NotificationCenterManager.shared.addDelegate(NotificationButtonWake.shared)
    return true
  }
}
