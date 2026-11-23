# StepUp English — Windows desktop app

The Windows desktop wrapper runs the learning app in its own native window using Microsoft Edge WebView2.

## Behavior

- Opens in a resizable Windows application window; it does not launch an external browser.
- Embeds the version-injected learning app, lessons and audio fallback data in the executable.
- Uses a loopback-only local origin so progress and settings persist between launches.
- Binds the local server only to 127.0.0.1 and does not expose a network service.

## Requirement

Microsoft Edge WebView2 Runtime must be installed. It is included with Windows 11 and is already installed on most Windows 10 devices. Once installed, the app itself runs offline.

## Build and version

The workflow `.github/workflows/build-desktop.yml` is reusable by the central release workflow. It reads the version from the root `version.json`, injects that value into the app, embeds the OgenPlay icon and builds a versioned EXE.

The central release workflow publishes the Windows EXE and Android APK together only after both platform builds pass.
