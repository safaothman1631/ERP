/**
 * @file firebase.ts
 * @description Firebase application initialization and service exports.
 *
 * This file centralizes all Firebase configuration and service instances for the
 * Zoho ERP frontend. It initializes the Firebase app with project credentials and
 * exports ready-to-use service instances for authentication, Firestore, and Analytics.
 *
 * ## Finding your Firebase config
 * 1. Go to the Firebase Console: https://console.firebase.google.com/
 * 2. Select your project (zoho-83cda)
 * 3. Click the gear icon → "Project settings"
 * 4. Scroll to "Your apps" → select the web app
 * 5. Copy the `firebaseConfig` object shown under "SDK setup and configuration"
 *
 * ## Security note
 * These values are public client-side identifiers — they are safe to commit.
 * Firebase security is enforced via Firestore Security Rules and Authentication,
 * NOT by keeping these keys secret.
 *
 * @see https://firebase.google.com/docs/web/setup
 * @see Requirements 6.1, 6.2
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

/**
 * Firebase project configuration object.
 *
 * All fields are read from Vite environment variables (VITE_FIREBASE_*).
 * For local development, copy `.env.local.example` to `.env.local` and fill in values.
 * For Vercel deployment, set these variables in the Vercel project dashboard under
 * Settings → Environment Variables for both Production and Preview environments.
 *
 * All fields are required for full Firebase functionality. They are obtained from
 * the Firebase Console under Project Settings → Your apps → Web app.
 *
 * ## Security note
 * These values are public client-side identifiers — they are safe to commit.
 * Firebase security is enforced via Firestore Security Rules and Authentication,
 * NOT by keeping these keys secret.
 */
const firebaseConfig = {
  /**
   * The Web API key for this Firebase project.
   * Used to authenticate requests from the browser to Firebase services.
   * Found in: Firebase Console → Project Settings → General → Web API key
   */
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string || 'AIzaSyDGM0lLMx0hbF0WuVx8Qr03u5GMs-h-xFw',

  /**
   * The Firebase Authentication domain for this project.
   * Used as the OAuth redirect domain for sign-in flows (e.g. Google Sign-In).
   * Format: <projectId>.firebaseapp.com
   * Found in: Firebase Console → Authentication → Settings → Authorized domains
   */
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string || 'zoho-83cda.firebaseapp.com',

  /**
   * The unique identifier for this Firebase project.
   * Used to scope all Firestore, Storage, and other service requests.
   * Found in: Firebase Console → Project Settings → General → Project ID
   */
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string || 'zoho-83cda',

  /**
   * The default Cloud Storage bucket for this project.
   * Used when uploading/downloading files via Firebase Storage.
   * Format: <projectId>.firebasestorage.app
   * Found in: Firebase Console → Storage → Files (shown in the bucket URL)
   */
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string || 'zoho-83cda.firebasestorage.app',

  /**
   * The sender ID for Firebase Cloud Messaging (FCM).
   * Required for push notifications. Identifies the Firebase project to FCM.
   * Found in: Firebase Console → Project Settings → Cloud Messaging → Sender ID
   */
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string || '363501065969',

  /**
   * The unique identifier for this specific web app registration within the project.
   * Format: 1:<messagingSenderId>:web:<uniqueHash>
   * Found in: Firebase Console → Project Settings → Your apps → App ID
   */
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string || '1:363501065969:web:5f18d232f71aeaacb6fb50',

  /**
   * The Google Analytics measurement ID linked to this Firebase project.
   * Enables Firebase Analytics and Google Analytics integration.
   * Format: G-XXXXXXXXXX
   * Found in: Firebase Console → Project Settings → Your apps → Measurement ID
   */
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string || 'G-3N2ZX9189E',
};

/**
 * The initialized Firebase application instance.
 * All Firebase services (auth, Firestore, etc.) are derived from this instance.
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication service instance.
 * Use this to sign users in/out and manage auth state.
 *
 * @example
 * import { auth } from './firebase';
 * const user = auth.currentUser;
 */
export const auth = getAuth(app);

/**
 * Firestore database service instance.
 * Use this to read and write documents in the Firestore database.
 *
 * @example
 * import { db } from './firebase';
 * const docRef = doc(db, 'users', userId);
 */
export const db = getFirestore(app);

/**
 * Google OAuth provider for Firebase Authentication.
 * Use this with `signInWithPopup` or `signInWithRedirect` to enable Google Sign-In.
 *
 * @example
 * import { auth, googleProvider } from './firebase';
 * await signInWithPopup(auth, googleProvider);
 */
export const googleProvider = new GoogleAuthProvider();
// Always show the Google account chooser (list ALL signed-in Google accounts)
// on every sign-in, instead of silently reusing the last account (prompt=none).
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Firebase Analytics instance (browser-only).
 * Null in SSR/non-browser environments to prevent initialization errors.
 * Use this to log custom analytics events.
 *
 * @example
 * import { analytics } from './firebase';
 * if (analytics) logEvent(analytics, 'page_view');
 */
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
