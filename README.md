# Secure Media App

A React Native application for securely encrypting and decrypting images and videos using password protection.

## Features

- Select images and videos from device gallery
- Encrypt media files with a password
- Decrypt encrypted files back to original format
- Secure local storage
- User-friendly interface

## Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

### Prerequisites

- Node.js >= 22.11.0
- React Native development environment set up

### Installation

1. Install dependencies:
```sh
npm install
```

2. For iOS, install CocoaPods:
```sh
cd ios && bundle exec pod install
```

### Running the App

1. Start Metro:
```sh
npm start
```

2. Build and run on Android:
```sh
npm run android
```

3. Or build and run on iOS:
```sh
npm run ios
```

## Usage

1. Tap "Select Image/Video" to choose media from your device
2. Enter a password for encryption
3. Tap "Encrypt Media" to secure the file
4. To decrypt, enter the password and tap "Decrypt" on the encrypted file

## Security Notes

- Files are encrypted using AES encryption
- Encrypted files are stored locally on the device
- Always remember your passwords as recovery is not possible
- This app provides client-side encryption only

## Technologies Used

- React Native
- react-native-image-picker
- crypto-js
- react-native-fs

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
