Pod::Spec.new do |s|
  s.name           = 'NotificationWake'
  s.version        = '1.0.0'
  s.summary        = 'Keeps MEDICARD running while a notification button is answered in the background'
  s.description    = 'Background time for notification buttons that do not open the app (mobile/src/lib/notificationWake.ts)'
  s.author         = 'MEDICARD'
  s.homepage       = 'https://medicard.ge'
  # ExpoNotifications needs iOS 16.4; a pod depending on it cannot ask for less.
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoNotifications'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
