import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBcx5aW2LxZVuiiyoSlIWyf7Wyogm6Zqi4",
  authDomain: "blindtestapp-cd177.firebaseapp.com",
  databaseURL: "https://blindtestapp-cd177-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "blindtestapp-cd177",
  storageBucket: "blindtestapp-cd177.firebasestorage.app",
  messagingSenderId: "212614020775",
  appId: "1:212614020775:web:5311d1000115dd87eba582"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
