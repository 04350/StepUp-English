# StepUp English — Windows desktop app

This is the native Windows desktop wrapper for the offline StepUp English learning app.

## What it does

- Opens in its own resizable Windows application window.
- Does not launch Chrome or Edge as a separate browser window.
- Embeds the complete learning app (including all audio fallback data) in the EXE.
- Uses Microsoft Edge WebView2 as the in-process rendering component.
- Uses a loopback-only local origin so lesson progress and settings persist between launches.
- Binds the local server only to 127.0.0.1; it does not expose a network service or contact the Internet.

## Windows requirement

Microsoft Edge WebView2 Runtime must be installed. It is included with Windows 11 and is already installed on most Windows 10 devices. A machine without the runtime needs a one-time installation of the official Microsoft WebView2 Runtime. After that, the app itself runs offline.

## Build

The GitHub Actions workflow `.github/workflows/build-desktop.yml` builds on a Windows runner:

1. Copies the repository's current `index.html` into this folder as `app.html`.
2. Builds `StepUp-English.exe` with Go and the pure-Go WebView2 bindings.
3. Uploads the executable as the workflow artifact `StepUp-English-Windows-x64`.

To start a build manually, open the repository's Actions tab and run **Build StepUp English desktop app**.
