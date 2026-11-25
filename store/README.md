# TruckTap Companion - store publishing

The companion is the same React field app wrapped with Capacitor.

- App name: **TruckTap**
- Android package: `com.trucktap.mobile`
- iOS bundle ID: `com.trucktap.mobile`
- Version: `1.0.0`
- Workspace model: existing TAP license key + optional Team Sync account
- Privacy policy: https://trucktap.net/privacy.html
- Support: https://trucktap.net/support.html
- Marketing: https://trucktap.net/

## Build

```bash
npm run mobile:sync
npx cap open android
npx cap open ios
```

Local signed Android artifacts are written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
android/app/build/outputs/apk/release/app-release.apk
```

The Android upload key is stored outside the repository at
`C:\Users\belld\.trucktap\trucktap-mobile-upload.keystore`. Back it up before
uploading the first Play release.

## GitHub Actions

The workflow templates are in `store/github-workflows/`. Copy them to
`.github/workflows/` after granting the GitHub CLI `workflow` scope:

```bash
gh auth refresh -h github.com -s workflow
cp store/github-workflows/*.yml .github/workflows/
git add .github/workflows && git commit -m "Add mobile publishing workflows" && git push
```

- `store/github-workflows/android.yml` builds a signed AAB/APK and can upload to Play.
- `store/github-workflows/ios.yml` archives, exports, and can upload the IPA.

Required repository secrets:

| Secret | Purpose |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the Android upload keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | `trucktap` |
| `ANDROID_KEY_PASSWORD` | Key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play service account JSON, only for uploads |
| `APPLE_API_KEY` | App Store Connect API `.p8` contents |
| `APPLE_API_KEY_ID` | 10-character App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer UUID |
| `APPLE_TEAM_ID` | Apple Developer team ID |

## Before submitting

1. Create the app record in App Store Connect with bundle ID `com.trucktap.mobile`.
2. Create the app in Google Play Console with package `com.trucktap.mobile`.
3. Confirm the Apple Developer team can create a distribution certificate and
   provisioning profile for the new bundle ID (the iOS workflow uses automatic
   signing).
4. Replace the draft store screenshots if desired.
5. Complete the Play data safety form and Apple privacy answers using
   `store/privacy-answers.md`.
6. Upload the AAB/IPA, then submit for review.

Store reviews can reject apps that link to external checkout for digital goods.
The native build hides purchase and download links; users activate a key they
already purchased on the web.
