# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Quickstart

### Snake Sound Trail Game
See [specs/003-snake-sound-trail/quickstart.md](specs/003-snake-sound-trail/quickstart.md) for feature-specific setup, seeding, and testing.

### Configuration Reference
- Snake game constants and speed model: [docs/snake-config.md](docs/snake-config.md)

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure Firebase env vars (create `.env`)

   ```bash
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Authentication Flows

StamFree uses Firebase Authentication with email verification:

### Sign Up Flow
1. User fills signup form (child name, age, parent details, email, password)
2. Firebase creates account with `createUserWithEmailAndPassword`
3. Verification email sent automatically via `sendEmailVerification`
4. User redirected to email verification screen
5. User clicks link in email or manually checks verification status
6. Once verified, user can access the app

### Login Flow
1. User enters email and password
2. Firebase authenticates via `signInWithEmailAndPassword`
3. **Email verification gate**: If email not verified, user blocked and prompted to verify
4. Once verified, user redirected to main app tabs

### Password Reset Flow
1. User clicks "Forgot Password?" on login screen
2. Enters email address
3. Firebase sends password reset email via `sendPasswordResetEmail`
4. User clicks link in email to reset password
5. User returns to login with new password

### Navigation Guards
- Unauthenticated users automatically redirected to login
- Unverified users blocked from accessing main app tabs
- Auth state persisted with Firebase Auth + AsyncStorage

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
