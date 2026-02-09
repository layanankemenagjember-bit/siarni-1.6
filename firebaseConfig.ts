import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// PERHATIAN: Error "permission-denied" yang Anda alami terjadi karena "YOUR_PROJECT_ID" 
// masih berupa teks placeholder. Silakan ganti dengan data dari Firebase Console Anda.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_ID",
  appId: "YOUR_APP_ID"
};

// Cek apakah user sudah mengisi config
export const isFirebaseConfigured = firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let app;
let db: any;
let storage: any;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { db, storage };

export const storageConfig = {
  type: 'cloud-first',
  syncMode: 'firebase-online',
  version: '11.2.0'
};