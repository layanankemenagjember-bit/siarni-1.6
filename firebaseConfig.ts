import { initializeApp } from "@firebase/app";
import { initializeFirestore } from "@firebase/firestore";
import { getAuth } from "@firebase/auth";

// Konfigurasi Firebase SIARNI JEMBER
export const firebaseConfig = {
  apiKey: "AIzaSyD7ry7T0TS-lLyE96JBaxptOXXpnkhC_k0",
  authDomain: "siarni-jember.firebaseapp.com",
  projectId: "siarni-jember",
  storageBucket: "siarni-jember.firebasestorage.app",
  messagingSenderId: "323108155926",
  appId: "1:323108155926:web:a15c04cd102a78e2e1fb37",
  measurementId: "G-3R3KWHC6CE"
};

const app = initializeApp(firebaseConfig);

/**
 * Menggunakan initializeFirestore sebagai ganti getFirestore 
 * untuk mengaktifkan experimentalForceLongPolling.
 * Ini memperbaiki error "Could not reach Cloud Firestore backend" 
 * yang disebabkan oleh blokir WebSocket pada beberapa jaringan.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const auth = getAuth(app);

// Menandakan konfigurasi sudah diisi
export const isFirebaseConfigured = true;