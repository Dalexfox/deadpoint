Pod::Spec.new do |s|
  s.name           = 'BrandedVideo'
  s.version        = '0.1.0'
  s.summary        = 'On-device branded video compositing (AVFoundation overlay)'
  s.description    = 'Burns a transparent overlay (the Deadpoint share card) onto a climb video and exports a new clip.'
  s.author         = 'Alex Fox'
  s.homepage       = 'https://github.com/Dalexfox/deadpoint'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
