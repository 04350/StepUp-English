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
- English text-to-speech voices, when used by the learning interface, depend on voices installed on the Android device. The bundled audio fallback remains part of the HTML app.

## Build

The workflow `.github/workflows/build-android.yml` copies the current `index.html` into the Android assets folder, compiles a signed debug APK, validates the APK archive and uploads it as `StepUp-English-Android`.

The debug APK is signed automatically by the Android Gradle plugin and can be installed manually. It is not a Play Store release-signed APK.
