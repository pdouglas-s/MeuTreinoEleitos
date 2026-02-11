import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

if (!config.apiKey || !config.projectId || !config.appId) {
  console.error('Missing required Firebase env variables. Please set EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_APP_ID');
  process.exit(1);
}

(async () => {
  try {
    const app = initializeApp(config);
    const db = getFirestore(app);
    const testDocRef = doc(db, 'integration_test', 'node_check');
    const payload = { ok: true, ts: serverTimestamp() };
    await setDoc(testDocRef, payload, { merge: true });
    const snap = await getDoc(testDocRef);
    if (snap.exists()) {
      console.log('Firebase write/read OK:', snap.data());
      process.exit(0);
    } else {
      console.error('Document not found after write.');
      process.exit(2);
    }
  } catch (err) {
    console.error('Firebase check failed:', err);
    process.exit(3);
  }
})();
