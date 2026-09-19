# CRUX iOS build preparation — v1.0.1 (build 2)

This is the updated full CRUX source and generated iOS project. **No IPA has been produced. Native compilation and iPhone validation remain pending.** See `RELEASE_REPORT.md` for actual results and limitations. The inherited archive filename is not a release certification.

CRUX remains a local-first bouldering logbook using Expo 54, React Native 0.81.5, Expo Router 6 and strict TypeScript. It supports V grades/ranges, attempts/results, editable sessions/history, projects/photos, goals and diagnostics. Sport/top-rope grades are not supported by this existing app.

## Windows

Use the included manual GitHub Actions workflow to build on a remote Mac. Read `WINDOWS_IPA_BUILD.md`. The workflow has not been run.

## Build the IPA on a Mac

Prerequisites: full Xcode with the iPhoneOS SDK, accepted Xcode licence, Node.js 20.19.4+ (a supported LTS is preferable), npm, and CocoaPods. React Native's installed source specifies Xcode 16.1+ and iOS 15.1+. Internet is needed to install dependencies and native pods.

From this project folder:

```bash
npm run build:ios:ipa
```

The script installs locked JavaScript dependencies, runs the release checks, installs CocoaPods, compiles the physical-device **Release** target without signing, verifies the embedded JavaScript bundle and arm64 architecture, and packages `build/CRUX_GYM_READY.ipa`. It stops on errors. No Apple credentials, EAS account, or public deployment are used by this path.

The script has passed shell syntax and Linux preflight checks only. Its macOS build path has NOT executed here. The first successful CocoaPods install must produce `ios/Podfile.lock`; retain that file. Later runs use `pod install --deployment`. Native dependency resolution cannot be claimed fully reproducible until that first Mac build is completed.

An unsigned IPA must be resigned by your chosen installer before it can launch. Compatibility with SideStore, AltStore and Sideloadly has not been device-tested. Keep the signing account and app identifier consistent for updates; deleting the installed app removes its local data.

## Validate source

```bash
npm ci
npm run verify
npx expo-doctor
npm run export:ios
```

The export command produces JavaScript/assets, **not** an IPA. The app embeds its JavaScript in the native Release build and does not require Expo Go for that build.

## Required phone checks

After a successful build and installation, use `DEVICE_CHECKLIST.md`. Check offline launch, navigation, session creation/edit/deletion, force-quit/relaunch persistence, history, photo permissions/camera/library, missing-photo handling, and diagnostics before relying on it at the gym.

## Architecture and storage

Screens → storage facade → repository/domain rules → schema manager → storage engine → AsyncStorage. Schema remains v8. Migration backups and malformed-data safeguards remain in place. The new undo journal restores interrupted multi-key writes before allowing reads. All production mutations use one repository instance; separate concurrent repository writers are not supported.

Native media is copied into the app documents directory. CRUX-owned photo URIs resolve against the current documents directory if iOS relocates its container. Diagnostic tests refuse to reuse an active session and report cleanup errors as failures.
