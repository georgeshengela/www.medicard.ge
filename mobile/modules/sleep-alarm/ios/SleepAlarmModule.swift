import ExpoModulesCore
import Foundation
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit
#endif

#if canImport(AlarmKit)
/// AlarmKit needs a metadata type; MEDISLEEP's alarm carries nothing extra.
@available(iOS 26.0, *)
struct SleepAlarmMetadata: AlarmMetadata {}
#endif

/// MEDISLEEP wake-up as a real iOS alarm (AlarmKit, iOS 26+): rings in silent mode and Focus, shows on the lock
/// screen, works with the app closed. JS side: mobile/src/lib/sleep/sleepAlarm.ts
/// (`requireOptionalNativeModule('MedicardSleepAlarm')`). On older systems `isAvailable()` is false and the JS side
/// falls back to a notification. Authorization is requested only from a button (`requestAuthorization`).
public class SleepAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MedicardSleepAlarm")

    Function("isAvailable") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return true }
      #endif
      return false
    }

    AsyncFunction("authorizationState") { () async -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        // `await` compiles whether the SDK exposes the property synchronously (a warning) or actor-isolated.
        let state = await AlarmManager.shared.authorizationState
        switch state {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unavailable"
        }
      }
      #endif
      return "unavailable"
    }

    AsyncFunction("requestAuthorization") { () async -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        do {
          let state = try await AlarmManager.shared.requestAuthorization()
          return state == .authorized
        } catch {
          return false
        }
      }
      #endif
      return false
    }

    /// One alarm at `timestamp` (seconds since 1970). Returns its id ("" when it could not be set).
    AsyncFunction("schedule") { (timestamp: Double, title: String, stopLabel: String, tint: String, sound: String?) async -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let stop = AlarmButton(
          text: LocalizedStringResource(stringLiteral: stopLabel),
          textColor: .white,
          systemImageName: "sun.max.fill"
        )
        let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop)
        let attributes = AlarmAttributes<SleepAlarmMetadata>(
          presentation: AlarmPresentation(alert: alert),
          tintColor: SleepAlarmModule.color(hex: tint)
        )
        let alertSound: ActivityKit.AlertConfiguration.AlertSound = {
          if let name = sound, !name.isEmpty, Bundle.main.url(forResource: name, withExtension: nil) != nil {
            return .named(name)
          }
          return .default
        }()
        let configuration = AlarmManager.AlarmConfiguration(
          countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: nil),
          schedule: Alarm.Schedule.fixed(Date(timeIntervalSince1970: timestamp)),
          attributes: attributes,
          sound: alertSound
        )
        let id = UUID()
        do {
          _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
          return id.uuidString
        } catch {
          return ""
        }
      }
      #endif
      return ""
    }

    /// Cancels a scheduled alarm, or stops it when it is ringing.
    AsyncFunction("cancel") { (alarmId: String) async -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        guard let uuid = UUID(uuidString: alarmId) else { return false }
        do {
          let alarms = try AlarmManager.shared.alarms
          if let alarm = alarms.first(where: { $0.id == uuid }), case .alerting = alarm.state {
            try AlarmManager.shared.stop(id: uuid)
          } else {
            try AlarmManager.shared.cancel(id: uuid)
          }
          return true
        } catch {
          return false
        }
      }
      #endif
      return false
    }
  }

  static func color(hex: String) -> Color {
    var value = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
    if value.count == 3 { value = value.map { "\($0)\($0)" }.joined() }
    guard value.count == 6 else { return Color.purple }
    var rgb: UInt64 = 0
    Scanner(string: value).scanHexInt64(&rgb)
    return Color(
      red: Double((rgb & 0xFF0000) >> 16) / 255.0,
      green: Double((rgb & 0x00FF00) >> 8) / 255.0,
      blue: Double(rgb & 0x0000FF) / 255.0
    )
  }
}
