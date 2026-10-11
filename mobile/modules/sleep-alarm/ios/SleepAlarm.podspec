Pod::Spec.new do |s|
  s.name           = 'SleepAlarm'
  s.version        = '1.0.0'
  s.summary        = 'MEDISLEEP wake-up through AlarmKit (iOS 26+)'
  s.description    = 'A real system alarm for sleep mode; JS side: mobile/src/lib/sleep/sleepAlarm.ts'
  s.author         = 'MEDICARD'
  s.homepage       = 'https://medicard.ge'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # AlarmKit exists from iOS 26; older systems must still launch the app.
  s.weak_frameworks = 'AlarmKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
