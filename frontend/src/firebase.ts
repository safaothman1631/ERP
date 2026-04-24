import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDGM0lLMx0hbF0WuVx8Qr03u5GMs-h-xFw',
  authDomain: 'zoho-83cda.firebaseapp.com',
  projectId: 'zoho-83cda',
  storageBucket: 'zoho-83cda.firebasestorage.app',
  messagingSenderId: '363501065969',
  appId: '1:363501065969:web:5f18d232f71aeaacb6fb50',
  measurementId: 'G-3N2ZX9189E',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
