#!/usr/bin/env bash
# Lokalny build APK na Androida bez EAS i bez konta Expo.
#   cd tanitoken/mobile && bash scripts/build-android-apk.sh
# Wymaga: Node 20+, JDK 17+ i Android SDK (ANDROID_HOME). Brakujące platformy, build-tools
# i NDK Gradle pobierze sam (po zaakceptowaniu licencji: sdkmanager --licenses).
# Wynik: dist-android/TaniToken-<wersja>.apk, podpisany kluczem debug (do testów, nie do Google Play).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Ustaw ANDROID_HOME na katalog Android SDK}"

node ../scripts/build-snapshot.mjs || echo "Uwaga: nie udało się odświeżyć cen, apka dostanie ostatni snapshot z repo"
npm install
npx expo prebuild --platform android --no-install --clean
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
# Telefony z ostatnich lat to arm64; armeabi-v7a dla starszych. Bez x86 (emulatory) build jest 2x szybszy.
sed -i.bak 's/^reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a,armeabi-v7a/' android/gradle.properties

(cd android && NODE_ENV=production ./gradlew assembleRelease --no-daemon)

VERSION=$(node -p "require('./app.json').expo.version")
mkdir -p dist-android
cp android/app/build/outputs/apk/release/app-release.apk "dist-android/TaniToken-$VERSION.apk"
echo "OK dist-android/TaniToken-$VERSION.apk"
echo "Instalacja na podłączonym telefonie: adb install -r dist-android/TaniToken-$VERSION.apk"
