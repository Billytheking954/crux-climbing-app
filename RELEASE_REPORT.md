# CRUX release validation — 19 September 2026

**Outcome: iOS build preparation completed; IPA generation BLOCKED.**

The complete source was repaired, tested, and given a generated iOS project plus a Mac build script. The host is Linux, `xcodebuild` is absent, and no iPhoneOS SDK or Mac builder is available. `npm run build:ios:ipa` exits 2 with that explicit blocker. No .app, .xcarchive or .ipa is being represented as built. The production Hermes bundle is an intermediate artifact only.

## Build information

| Field | Value |
|---|---|
| App | CRUX |
| Version / build | 1.0.1 / 2 |
| Bundle identifier | com.joshua.crux (none was configured previously) |
| Expo resolved version | 54.0.37 |
| React Native | 0.81.5 |
| React / Expo Router | 19.1.0 / 6.0.24 |
| Storage schema | 8, retained |
| iOS deployment target | 15.1 |
| JavaScript engine / architecture | Hermes / React Native New Architecture |
| Intended build | Release, physical iPhoneOS, arm64 |
| Signing | Not performed; Mac script targets an unsigned IPA |
| EAS / backend / publication | Not used |
| Validation runtime | Linux, Node v24.19.0 |

## Actual validation results

BLOCKED and NOT RUN indicate unavailable checks, not passes.

| Check | Result | Evidence or limitation |
|---|---|---|
| Clean dependency installation from updated lockfile | PASS | `npm ci`; 927 packages installed |
| Strict TypeScript | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint`, no reported errors/warnings |
| Source architecture verification | PASS | Storage boundary, diagnostics route, supported settings, schema v8 |
| All safety tests | PASS | 12 suites, including 7 added regression suites |
| Grade/result/attempt invariants | PASS | Existing domain safety tests |
| Fresh store and legacy migration | PASS | In-memory storage adapter, schema-v8 backups and normalization |
| Malformed data preservation | PASS | Writes refused; original malformed bytes retained |
| Legacy duplicate photos | PASS | Duplicate skipped; later unique photo retained |
| Invalid/future schema version | PASS | Mutation rejected without version overwrite |
| Create/read/edit/delete | PASS | Repository lifecycle tests |
| Rapid writes | PASS | 30 starts reuse one active session; 100 climb additions survive a new repository instance; 20 concurrent goals retained |
| Session/project reconciliation | PASS | Complete, edit/reopen, delete links and session finish idempotency |
| Interrupted multi-key save | PASS | Injected partial failure restores both collections |
| Simulated process-death recovery | PASS | Seeded undo journal recovered by new repository before reading; corrupt journal blocks reads |
| Large history | PASS | 300 sessions / 6,000 climbs load; old climb edit persists |
| Diagnostics isolation and truthful cleanup | PASS | Success, failed cleanup, active-session refusal, concurrent-start race |
| Durable photo logic | PASS | Mock filesystem copy survives cache removal; relocated container resolves; traversal cleanup refused |
| Expo dependency compatibility | PASS | `expo install --check`: dependencies up to date |
| Expo Doctor | PASS | 18/18 after native dependency deduplication and clean reinstall |
| iOS native project generation | PASS | `expo prebuild --platform ios --no-install` |
| Native config inspection | PASS | Bundle ID, build 2, target 15.1, camera/photo messages; no microphone permission |
| Production iOS JavaScript export | PASS | Minified Hermes .hbc, approximately 4.38 MB |
| Production web export / route generation | PASS | Shared screens bundle successfully |
| Build script syntax / unsupported-host guard | PASS | `bash -n`; Linux guard correctly exits 2 |
| Browser UI interaction | BLOCKED | Browser executable absent; attempted Chromium download timed out |
| CocoaPods install and native linking | BLOCKED | No macOS/Xcode environment; Podfile.lock not generated |
| Native Release compilation / archive / IPA | BLOCKED | Linux host and missing Xcode/iPhoneOS SDK |
| Actual iPhone launch/navigation/offline operation | NOT RUN | No native binary or connected phone |
| iPhone kill/relaunch persistence | NOT RUN | Repository restart tests are not native process tests |
| iPhone camera/library permission prompts/photos | NOT RUN | Logic and config validated; native APIs not exercised |
| SideStore / AltStore / Sideloadly installation | NOT RUN | No IPA exists |

Logs are in `validation/`. `build/production/` contains production export output, not an installable app.

## Changes and root causes

1. **Migration photo loss:** legacy photo normalization returned the entire accumulated list when encountering one duplicate, silently dropping all later photos. It now skips just that duplicate; malformed records still fail safely.
2. **Version parsing:** `parseInt` accepted values such as `8garbage`. Schema versions now require a complete nonnegative integer and reject unsafe/future values.
3. **Interrupted writes:** multi-key writes had no durable undo record. Added a validated, restricted-key undo journal, idempotent recovery, and serialized schema reads/writes. Failed or interrupted writes restore previous values before subsequent reads. Existing schema and migration backups remain.
4. **False diagnostic success:** return values were constructed before `finally` cleanup. Results are now created after cleanup so a failed cleanup cannot report PASS.
5. **Diagnostic race:** a real session created after diagnostic preflight could be reused and later deleted. Diagnostics now request an exclusively new session inside the existing mutation queue; an active session causes refusal.
6. **Full-screen photos:** integrated the useful project-details changes from the separate replacement pack. The repository was byte-identical to the full project's implementation; session differences were cosmetic, so neither was blindly overwritten.
7. **Photo reliability:** added a missing-image fallback, safe resolution of CRUX-owned media against the current document directory, and restricted cleanup to owned filenames. A camera action complements photo-library selection. Library selection uses the system picker without demanding broad library permission first. Photo records remain local.
8. **Native configuration:** generated `ios/`, set identifier/build, added image-picker usage descriptions, and disabled microphone permission. Existing icon/splash artwork remains unchanged.
9. **Dependency duplicate:** Expo Doctor found two copies of expo-file-system. `npm dedupe` updated the lockfile within the existing package ranges; a clean reinstall confirms one copy and passing diagnostics. No new runtime dependency was added. Exact package version changes are recorded in `DEPENDENCY_CHANGES.json`.
10. **Build handoff:** added the guarded local Mac Release/IPA script, source/native checks, device checklist, and this report. Native source is included and no longer excluded wholesale by .gitignore.

## Remaining issues

**Blocker:** A Mac with full Xcode, iPhoneOS SDK and CocoaPods must compile the native app. Native compilation can still reveal errors that JavaScript export cannot detect. This is a tooling blocker, not merely missing signing credentials.

**Important:** All physical-device checks in DEVICE_CHECKLIST.md remain required. Native CocoaPods dependency locking remains pending. Installer resigning and app update behaviour are unverified. Repository tests use an in-memory adapter and media tests use a mocked filesystem; they do not prove native durability or UI performance with large histories. A failed photo save can leave an unreferenced local file; preserving it is safer than deleting a potentially referenced file after an ambiguous storage error.

**Optional polish:** Replace the original Expo-style icon/splash with final CRUX artwork. Add media orphan cleanup only with a reference-aware recovery policy. Sport/top-rope support would be a separate feature; the existing app intentionally supports bouldering only.

## Shortest remaining build process

On a Mac configured with Xcode, Node/npm and CocoaPods, open a terminal in the included project and run:

```bash
npm run build:ios:ipa
```

If it succeeds, output is `build/CRUX_GYM_READY.ipa`, unsigned and requiring resigning. The script verifies arm64, iPhoneOS and embedded JavaScript before packaging. Its macOS path remains unexecuted here. It does not submit or publish anything. Install with the chosen signing tool and complete DEVICE_CHECKLIST.md.

**Sideloading status: BLOCKED FROM IPA GENERATION.** No installer is marked ready.

## Reference documentation

Permission configuration was checked against [Expo SDK 54 ImagePicker documentation](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/) and the installed plugin implementation. Native requirements were checked in the installed React Native CocoaPods helper and [React Native environment setup](https://reactnative.dev/docs/0.81/set-up-your-environment). Tests and local generated files, rather than documentation alone, support the PASS entries above.

## Windows build handoff

Added a manual-only GitHub Actions macos-15 workflow calling the existing Release build script and uploading the unsigned IPA plus logs. YAML structure and script linkage passed local validation. No remote run was submitted, no IPA was produced, and Actions allowance/cost remains account-dependent. See WINDOWS_IPA_BUILD.md.
