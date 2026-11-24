# StepUp English for Android

The Android application is a self-contained wrapper around the repository's offline learning app.

## App behavior

- Opens as a standalone Android application.
- Packages a version-injected copy of the root `index.html` into the APK.
- Uses Android System WebView with JavaScript and local storage enabled.
- Does not require Internet permission for learning content.
- Keeps lesson progress and settings in the app's local WebView storage.
- Includes all lessons and the bundled MP3 fallback recordings for all 284 dictionary entries.
- Uses an installed offline English TextToSpeech voice for sentence reading when available. The embedded word recordings remain available without that voice.
- Supports exporting a backup and selecting a JSON backup file for restore.

## Requirements

- Android 6.0 (API 23) or newer.
- No account, subscription or Internet connection is required for lessons and bundled word audio.

## Version source

The root `version.json` file is the only source for Android `versionName` and `versionCode`. Gradle reads it directly.

## Build and CI

The reusable workflow `.github/workflows/build-android.yml` validates the curriculum, prepares the launcher icon, injects the canonical version, builds the APK, verifies its contents and signature, and runs an Android emulator smoke test with up to three attempts.

The central workflow `.github/workflows/release.yml` calls both platform build workflows and publishes a single GitHub Release only after both succeed.

## Signing and upgrade safety

Pull-request and manual development builds use the Gradle debug configuration. A public release APK is built only when the dedicated Android signing secrets are configured. See [SIGNING.md](SIGNING.md) before the first dedicated-key release; a signing-certificate change may require a backup, reinstall and restore migration.
