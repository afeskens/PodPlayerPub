# Building the Podcast Player APK

This app is fully self-contained — it calls iTunes Search directly and parses podcast RSS feeds on-device. **No backend server is required** once you install the APK. All you need on your phone is an internet connection.

## What you need

- A free **Expo account** → https://expo.dev/signup
- **Node.js 18+** installed on your computer → https://nodejs.org
- This project folder (download it from Emergent: profile menu → "Save to GitHub", or use the download option)

## Build the APK (first time)

```bash
# 1. Install EAS CLI globally (one-time)
npm install -g eas-cli

# 2. Move into the frontend folder
cd frontend

# 3. Install dependencies
npm install    # or: yarn install

# 4. Sign in to Expo (opens browser for login)
eas login

# 5. Link this project to your Expo account
eas init     # pick "Yes, create a new project" when prompted

# 6. Kick off the APK build
eas build --platform android --profile preview
```

After ~10–20 minutes on Expo's free tier, you'll get a URL printed in your terminal (and emailed) that downloads the APK.

## Install on your phone

1. Open the download URL on your Android phone (or transfer the `.apk` via USB / Google Drive).
2. Tap the file. Android will ask you to allow installs from unknown sources — confirm.
3. Done! The app appears in your launcher as **Podcast Player**.

## Rebuilding later

Any time you change the code:
```bash
cd frontend
eas build --platform android --profile preview
```
That's it. No need to re-run `eas init` or `eas login`.

## Notes

- The `production` profile in `eas.json` builds an AAB (for Play Store). Use `preview` for APKs you want to side-load.
- If you want a smaller APK per CPU architecture, edit `eas.json` and add `"buildType": "apk"` + let EAS split per ABI.
- The backend folder in this repo is no longer required for the APK. You can delete `/backend` if you want — it was only used during development.

## Troubleshooting

- **"Experience with id ... does not exist"** — you skipped `eas init`. Run it.
- **"Cannot find module ..."** — run `npm install` in the `frontend` folder first.
- **Build succeeds but RSS feeds fail on device** — check that the phone has internet. Some corporate Wi-Fi blocks direct RSS traffic; try mobile data.
