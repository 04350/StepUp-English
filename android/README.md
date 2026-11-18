# StepUp English for Android

This folder contains the Android application wrapper for the existing offline learning app.

## App behavior

- Opens as a standalone Android application (not in an external browser).
- Packages the repository's current root `index.html` into the APK at build time.
- Uses Android System WebView with JavaScript and local storage enabled.
- Requires no Internet permission and blocks external navigation.
- Keeps lesson progress and settings in the app's local WebView storage.
- Includes the offline lessons and embedded pronunciation audio from `index.html`.
- Supports selecting a local backup file for restore and saving generated backup files into the device's Downloads folder.

## Requirements

- Android 6.0 (API 23) or newer.
- No account, subscription, or Internet connection required to use the lessons.
- Uses the Android TextToSpeech engine when an installed English voice that does not require network access is available.
- Falls back to the locally available WebView speech voice and the recordings embedded in the app.
- Some newer vocabulary entries require an offline English system voice; the app does not download speech data.

## Build

The workflow `.github/workflows/build-android.yml` copies the current `index.html` into the Android assets folder, compiles a signed debug APK, validates the APK archive and uploads it as `StepUp-English-Android` with the versioned APK filename `StepUp-English-v1.3.1.apk`.

The debug APK is signed automatically by the Android Gradle plugin and can be installed manually. It is not a Play Store release-signed APK.


## Continuous integration verification

The Android workflow also runs for pull requests and checks that the APK is a valid ZIP, that it contains the byte-for-byte current root `index.html`, and that its Android signature verifies.
