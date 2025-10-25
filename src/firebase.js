import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBcx5aW2LxZVuiiyoSlIWyf7Wyogm6Zqi4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "blindtestapp-cd177.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://blindtestapp-cd177-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blindtestapp-cd177",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blindtestapp-cd177.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "212614020775",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:212614020775:web:5311d1000115dd87eba582"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
