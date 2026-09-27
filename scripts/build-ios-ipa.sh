#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'BLOCKED: iPhone native compilation requires macOS with full Xcode and the iPhoneOS SDK.' >&2
  exit 2
fi
for tool in node npm xcodebuild xcrun pod; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 2; }
done
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
npm ci --no-audit --no-fund
npm run release:check
# The generated ios project is included. Prebuild only if it is absent.
if [[ ! -f ios/CRUX.xcodeproj/project.pbxproj ]]; then
  CI=1 npx expo prebuild --platform ios --no-install
fi
# Avoid carrying a different machine's Node path into Xcode.
node_binary="$(command -v node)"
printf 'export NODE_BINARY="%s"\n' "$node_binary" > ios/.xcode.env.local
if [[ -f ios/Podfile.lock ]]; then
  (cd ios && pod install --deployment)
else
  (cd ios && pod install)
fi
mkdir -p build
xcodebuild \
  -workspace ios/CRUX.xcworkspace \
  -scheme CRUX \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$PWD/build/native" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  build | tee build/xcodebuild-release.log
app_path="$PWD/build/native/Build/Products/Release-iphoneos/CRUX.app"
[[ -d "$app_path" ]] || { echo 'Device app bundle missing.' >&2; exit 1; }
[[ -s "$app_path/main.jsbundle" ]] || { echo 'Embedded Release JavaScript bundle missing.' >&2; exit 1; }
platform="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleSupportedPlatforms:0' "$app_path/Info.plist")"
[[ "$platform" == iPhoneOS ]] || { echo 'Refusing to package a non-device app.' >&2; exit 1; }
xcrun lipo "$app_path/CRUX" -verify_arch arm64
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Info.plist")" == com.joshua.crux ]] || { echo 'Unexpected bundle identifier.' >&2; exit 1; }
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app_path/Info.plist")" == CRUX ]] || { echo 'Unexpected executable.' >&2; exit 1; }
staging="$(mktemp -d "$PWD/build/ipa.XXXXXX")"
trap 'rm -rf "$staging"' EXIT
mkdir -p "$staging/Payload"
ditto "$app_path" "$staging/Payload/CRUX.app"
output_ipa="$PWD/build/CRUX_GYM_READY.ipa"
(cd "$staging" && /usr/bin/zip -qry "$staging/CRUX_GYM_READY.ipa" Payload)
mv "$staging/CRUX_GYM_READY.ipa" "$output_ipa"
unzip -tq build/CRUX_GYM_READY.ipa
unzip -Z1 build/CRUX_GYM_READY.ipa > build/ipa-entries.txt
grep -Fxq 'Payload/CRUX.app/Info.plist' build/ipa-entries.txt
grep -Fxq 'Payload/CRUX.app/CRUX' build/ipa-entries.txt
grep -Fxq 'Payload/CRUX.app/main.jsbundle' build/ipa-entries.txt
shasum -a 256 build/CRUX_GYM_READY.ipa > build/CRUX_GYM_READY.ipa.sha256
printf '\nCreated build/CRUX_GYM_READY.ipa (UNSIGNED; requires installer resigning).\n'
printf 'Device installation and offline smoke tests must pass before declaring gym ready.\n'
