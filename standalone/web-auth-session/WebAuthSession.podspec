Pod::Spec.new do |s|
  s.name         = "WebAuthSession"
  s.version      = "0.2.0"
  s.summary      = "Open a URL in the system auth browser and get the callback URL back"
  # CocoaPods requires these three. The values are placeholders for a module that lives in the app.
  s.homepage     = "https://example.com"
  s.authors      = "app"
  s.source       = { :path => "." }

  s.platforms    = { :ios => min_ios_version_supported }
  s.source_files = "ios/**/*.{h,mm}"
  s.frameworks   = "AuthenticationServices"

  install_modules_dependencies(s)
end
