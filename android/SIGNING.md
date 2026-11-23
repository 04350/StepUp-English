# Android signing and upgrade safety

The currently published APKs were built with the Android Gradle **debug** signing configuration. A debug-signed APK is suitable for testing and manual installation, but a CI runner must not be assumed to retain the same debug keystore between independent runs.

The release workflow therefore publishes an Android APK only when a dedicated keystore is configured. Until then it still builds, installs and smoke-tests a debug APK, but it deliberately skips creating a public release.

## Configure the release key

Create a dedicated key once and keep a secure offline copy. Do not commit the keystore or passwords to Git.

```bash
keytool -genkeypair -v -keystore stepup-release.jks -alias stepup -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 stepup-release.jks > stepup-release.base64
```

Add these GitHub Actions repository secrets:

- `STEPUP_ANDROID_KEYSTORE_BASE64` — the one-line Base64 contents of the keystore.
- `STEPUP_ANDROID_KEYSTORE_PASSWORD` — the keystore password.
- `STEPUP_ANDROID_KEY_ALIAS` — the key alias (for example, `stepup`).
- `STEPUP_ANDROID_KEY_PASSWORD` — the key password.

The release workflow checks that all four secrets are present before it asks Gradle to create a release-signed APK. The temporary keystore is written only on the hosted runner and is excluded by `.gitignore`.

## Important one-time migration

A new dedicated keystore may not match the certificate used to sign the already-published v1.4.2 debug APK. Android will reject an in-place update when the signing certificate differs.

Before publishing the first APK signed with the new key:
1. In the existing app, export the progress backup to a file and verify that the file was saved.
2. Install the first dedicated-key APK. This may require uninstalling the older debug-signed installation first.
3. Reopen the app and import the backup.
4. Confirm that lessons, scores, known words and settings were restored.

Do not assume certificate compatibility. Verify the SHA-256 signing certificate of the current APK and the new release APK before announcing an in-place upgrade.

After the migration, keep the same keystore for every future release. Losing it prevents Android from accepting updates signed with the replacement key.
