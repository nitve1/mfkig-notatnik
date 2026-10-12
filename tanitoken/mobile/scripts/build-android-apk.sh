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
# Telefony z ostatnich lat to arm64 (APK ok. 30 MB). Dla starszych 32-bitowych: ARCHS=arm64-v8a,armeabi-v7a (ok. 43 MB).
ARCHS="${ARCHS:-arm64-v8a}"
sed -i.bak "s/^reactNativeArchitectures=.*/reactNativeArchitectures=$ARCHS/" android/gradle.properties

(cd android && NODE_ENV=production ./gradlew assembleRelease --no-daemon)

VERSION=$(node -p "require('./app.json').expo.version")
mkdir -p dist-android
cp android/app/build/outputs/apk/release/app-release.apk "dist-android/TaniToken-$VERSION.apk"
echo "OK dist-android/TaniToken-$VERSION.apk"
echo "Instalacja na podłączonym telefonie: adb install -r dist-android/TaniToken-$VERSION.apk"
