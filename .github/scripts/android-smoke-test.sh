#!/usr/bin/env bash
set -Eeuo pipefail

APK_PATH="android/app/StepUp-English.apk"
PACKAGE_NAME="com.stepupenglish.app"
ACTIVITY_NAME="com.stepupenglish.app/.MainActivity"

fail() {
  echo "::error::$1"
  echo "---- ADB devices ----"
  adb devices -l || true
  echo "---- Recent Android runtime errors ----"
  adb logcat -d -t 400 -s AndroidRuntime:E || true
  exit 1
}

test -s "$APK_PATH" || fail "The APK file was not found: $APK_PATH"
adb start-server

echo "Waiting for Android emulator to be online and fully booted..."
READY=0
for attempt in $(seq 1 36); do
  STATE="$(adb get-state 2>/dev/null || true)"
  if [ "$STATE" = "device" ]; then
    BOOT_COMPLETE="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [ "$BOOT_COMPLETE" = "1" ]; then
      READY=1
      break
    fi
  elif [ "$STATE" = "offline" ]; then
    adb reconnect offline || true
  fi
  sleep 5
done
[ "$READY" = "1" ] || fail "Android emulator did not become ready after 180 seconds"

echo "Checking Android package manager..."
PACKAGE_READY=0
for attempt in $(seq 1 12); do
  if adb shell cmd package list packages >/dev/null 2>&1; then
    PACKAGE_READY=1
    break
  fi
  sleep 5
done
[ "$PACKAGE_READY" = "1" ] || fail "Android package manager did not become ready"

echo "Installing APK, with up to 3 attempts..."
INSTALLED=0
for attempt in 1 2 3; do
  echo "Install attempt $attempt of 3"
  if adb install -r --no-streaming "$APK_PATH"; then
    INSTALLED=1
    break
  fi
  adb reconnect offline || true
  adb wait-for-device || true
  sleep 8
done
[ "$INSTALLED" = "1" ] || fail "APK installation failed after 3 attempts"

adb shell pm path "$PACKAGE_NAME" | grep -q '^package:' || fail "Package manager cannot find the installed app"
adb logcat -c
adb shell am force-stop "$PACKAGE_NAME" || true

echo "Launching StepUp English..."
START_OUTPUT="$(adb shell am start -W -n "$ACTIVITY_NAME" 2>&1)" || {
  echo "$START_OUTPUT"
  fail "Android could not launch the main activity"
}
echo "$START_OUTPUT"

echo "Checking that the app remains alive..."
sleep 10
APP_PID="$(adb shell pidof "$PACKAGE_NAME" 2>/dev/null | tr -d '\r' || true)"
[ -n "$APP_PID" ] || fail "The app process exited after launch"

ACTIVITY_DUMP="$(adb shell dumpsys activity activities 2>/dev/null || true)"
printf '%s\n' "$ACTIVITY_DUMP" | grep -F "$ACTIVITY_NAME" >/dev/null || fail "MainActivity is not present in the activity stack"

if adb logcat -d -s AndroidRuntime:E | grep -q "FATAL EXCEPTION"; then
  fail "Android reported a fatal exception during app startup"
fi

echo "SUCCESS: StepUp English installed and launched on the Android emulator (PID $APP_PID)."
