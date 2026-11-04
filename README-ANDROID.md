# My Money Manager — Android APK Build & Installation Guide

This project is configured with **Capacitor 8** for Android, packaging your complete React, TypeScript, and Tailwind CSS application into a native Android app with package ID `com.mymoneymanager.app`.

---

## Method 1: Automated Cloud Build via GitHub Actions (Recommended — Zero Local Setup)

No need to install Android Studio or the Android SDK on your computer.

### Step 1: Initialize Git and Push to GitHub
If you haven't connected this project to GitHub yet, run the following in your terminal:
```bash
git init
git add .
git commit -m "feat: complete My Money Manager Android app with Capacitor"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/my-money-manager.git
git push -u origin main
```

### Step 2: Automatic APK Generation
1. Go to your repository on **GitHub**.
2. Click the **Actions** tab at the top.
3. You will see the **"Build Android APK"** workflow running automatically.
   *(You can also click "Run workflow" manually at any time).*
4. In approximately 2–3 minutes, the build will complete with a green checkmark.

### Step 3: Download & Install on Your Phone
1. Click on the completed workflow run.
2. Scroll down to the **Artifacts** section at the bottom of the page.
3. Download **`MyMoneyManager-Debug-APK`** (it downloads a `.zip` containing `app-debug.apk`).
4. Transfer `app-debug.apk` to your Android phone (or download directly from your phone's browser).
5. Tap the `.apk` file to install.
   - If prompted: Allow **"Install unknown apps"** for your file manager or browser.
6. Open **My Money Manager** on your phone!

---

## Method 2: Local Build using Android Studio

If you prefer building locally on your PC or Mac:

### Prerequisites
- [Android Studio](https://developer.android.com/studio) installed with Android SDK 34+.
- Java JDK 17+.
- Node.js 20+.

### Steps
1. Build the web app and sync the Android assets:
   ```bash
   npm run build
   npx cap sync android
   ```
2. Open the native Android project in Android Studio:
   ```bash
   npx cap open android
   ```
   *(Or open Android Studio and choose `File > Open`, then select the `android` folder in this repo).*
3. Wait for Gradle to finish indexing.
4. **To test on a connected phone or emulator:**
   - Plug in your phone via USB (with USB Debugging enabled) and click the green **Play (Run)** button.
5. **To generate an APK:**
   - Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - Once completed, click the **"locate"** link in the popup.
   - Your APK is located at: `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## Backend Connectivity & Database

The Android APK is configured with dynamic server routing:
- **Default Production Server:** Connects to `https://ais-pre-77bhmhkxvu52nopsk7bxom-844589323095.asia-northeast1.run.app`.
- **Custom Endpoint Configuration:** In the app, navigate to **Settings > Android & API Server Connection** to test the connection or change the backend URL at any time without rebuilding the APK.
- **Data Persistence:** All transactions, fuel logs, allocations, and accounts are stored in the ACID SQLite database (`moneymanager.db`).

---

## How to Generate a Signed Release APK

When you are ready to produce a signed release APK (for Google Play Store or permanent personal signing):

1. **Generate a private keystore** on your computer:
   ```bash
   keytool -genkey -v -keystore mymoneymanager-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mymoneymanager
   ```
2. In Android Studio:
   - Click **Build > Generate Signed Bundle / APK**.
   - Select **APK**.
   - Choose your `mymoneymanager-release-key.jks` file, enter your password and alias.
   - Select **release** build variant and check **V1 (Jar Signature)** and **V2 (Full APK Signature)**.
   - Click **Create**.
3. Your signed APK will be output to:
   `android/app/release/app-release.apk`.
