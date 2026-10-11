import ExpoModulesCore

/// JS side: mobile/src/lib/notificationWake.ts (`requireOptionalNativeModule('MedicardNotificationWake')`).
public class NotificationWakeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MedicardNotificationWake")

    Function("release") {
      NotificationButtonWake.shared.release()
    }
  }
}
