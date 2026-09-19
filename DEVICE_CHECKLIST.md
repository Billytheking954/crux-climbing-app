# Required physical iPhone release checks — all pending

Record the iPhone model, iOS version, signing tool, app version/build and date. Use test data before relying on CRUX for a gym visit.

- [ ] Mac Release build succeeds and produces a real arm64 iPhoneOS IPA.
- [ ] IPA resigns and installs with the chosen sideloading tool.
- [ ] Fresh install launches without Metro or Expo Go.
- [ ] Enable airplane mode; navigate Home, Projects, Goals, Stats and Settings.
- [ ] Start a session, log named V-grade climbs with attempts and each supported result.
- [ ] Force-quit, reopen offline and verify gym, timer, climbs and attempts are restored.
- [ ] Edit/delete a climb, finish the session, open History and verify saved details.
- [ ] Edit/reopen a saved session; verify only one session can be active.
- [ ] Add a project and link an entry; completing/editing/deleting it updates the project correctly.
- [ ] Select a photo, take a camera photo, open each full-screen, relaunch and verify both remain.
- [ ] Deny camera permission; verify a useful message and continued library selection.
- [ ] Remove photos; verify the project and remaining photos still work.
- [ ] Test a missing photo path on a test installation; verify the fallback and removal action.
- [ ] With no active session, run Full Lifecycle Test; verify all checks pass and the fixture disappears.
- [ ] With a real active session, diagnostics must refuse and preserve its contents.
- [ ] Update the signed app in place and confirm sessions/photos remain. Do not delete it first.

Native camera, permission prompts, filesystem durability, restart/offline behaviour, navigation and installer compatibility have not been exercised on an iPhone in this environment.
