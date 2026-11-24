# StepUp English — Changelog

## 1.4.3 — Reliability and maintenance

- Centralized application version and Android version code in `version.json`.
- Unified Windows and Android release publishing so a public release is created only after both platform builds succeed.
- Added a dedicated release-signing gate for Android. Public APK releases are skipped until a persistent keystore is configured.
- Hardened backup import validation, kept compatibility with existing version 1 backup files, and added a version 2 backup format with export metadata.
- Added automated backup round-trip and invalid-file safety checks.
- Added structural validation of the embedded MP3 audio payloads.
- Added a 10-word daily practice session using words not yet marked as known.
- Improved placement-test feedback with per-level percentages and the recommendation rule.
- Corrected outdated documentation and the home-screen level count.
- Fixed the Windows WebView2 storage origin to reuse a persisted loopback port, and added unit tests for port persistence and loopback-only binding.
- **Upgrade note:** export a backup from Windows v1.4.2 or earlier before installing v1.4.3, then restore it once; the older builds used a random local port on each launch.
- Kept all learning content and audio packaged locally for offline use.
