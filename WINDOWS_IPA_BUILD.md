# Build CRUX from Windows using a remote Mac

The included `.github/workflows/build-ios-ipa.yml` builds on a GitHub-hosted Mac. It runs only when manually requested. It uploads the unsigned IPA as a workflow artifact, not as a public release. No Apple credentials are needed for this unsigned build.

1. Put the **contents of this crux-climbing-app folder** at the root of a private GitHub repository: package.json, ios/, app/, .github/, and all other source files. Do not upload just the ZIP. Keep .github/workflows/build-ios-ipa.yml at the repository root's .github path. GitHub Desktop on Windows can commit/push the whole folder including .github.
2. Ensure the workflow is on the repository's default branch and Actions is enabled. Check Actions usage/budget first: private macOS runners consume your included allowance and can incur charges beyond it. Do not enable paid usage if you want this kept free. No build has been submitted from this chat.
3. Open **Actions → Build CRUX IPA → Run workflow**.
4. If the run succeeds, open it and download **CRUX_GYM_READY_UNSIGNED** under Artifacts. Extract that downloaded ZIP to obtain **CRUX_GYM_READY.ipa**.
5. Give the IPA to your chosen Windows-compatible sideloading/signing tool. The app still needs resigning; this workflow does not sign it or certify installer compatibility.
6. Follow DEVICE_CHECKLIST.md after installing. If the run fails, retain its logs and CRUX_BUILD_DIAGNOSTICS artifact for fixing the actual build error. Commit the generated Podfile.lock after the first successful build for locked native dependencies.

The workflow configuration was parsed and checked locally. It has not run on GitHub, and no IPA has yet been generated. This moves the native build to a real Mac; Windows itself does not compile the iOS application.

References:
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
