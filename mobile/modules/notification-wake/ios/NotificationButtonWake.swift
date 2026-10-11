import ExpoNotifications
import UIKit
import UserNotifications

/**
 Background time for a notification button answered without opening the app („მივიღე ✓“).

 expo-notifications calls iOS's completion handler for a response before JS has seen it
 (NotificationCenterManager / EmitterModule), and iOS may then suspend the app — often a locked phone
 launched in the background — while the handler is still saving the dose. A background task keeps the
 app running until JS calls `release()` (notificationWake.ts, after the answer is saved and its event
 sent) or 25 s pass; iOS allows about 30 s.
 */
final class NotificationButtonWake: NSObject, NotificationDelegate {
  static let shared = NotificationButtonWake()

  // Touched on the main thread only.
  private var task: UIBackgroundTaskIdentifier = .invalid
  private var generation = 0

  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    let action = response.actionIdentifier
    if action != UNNotificationDefaultActionIdentifier && action != UNNotificationDismissActionIdentifier {
      onMain { $0.hold() }
    }
    // Never "handled": expo keeps the response for JS until its emitter exists.
    return false
  }

  func release() {
    onMain { $0.end() }
  }

  private func onMain(_ work: @escaping (NotificationButtonWake) -> Void) {
    if Thread.isMainThread {
      work(self)
    } else {
      DispatchQueue.main.async { work(self) }
    }
  }

  private func hold() {
    if task == .invalid {
      task = UIApplication.shared.beginBackgroundTask(withName: "medicard.notification-action") { [weak self] in
        self?.end()
      }
    }
    generation += 1
    let current = generation
    DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in
      guard let self = self, self.generation == current else { return }
      self.end()
    }
  }

  private func end() {
    guard task != .invalid else { return }
    UIApplication.shared.endBackgroundTask(task)
    task = .invalid
  }
}
