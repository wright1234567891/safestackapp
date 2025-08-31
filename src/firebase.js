// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCsNpONRZ11W1_YC4OR1t8I2r6WESkM3X8",
  authDomain: "wrights-oak-and-smoke.firebaseapp.com",
  projectId: "wrights-oak-and-smoke",
  storageBucket: "wrights-oak-and-smoke.firebasestorage.app",
  messagingSenderId: "501270954180",
  appId: "1:501270954180:web:d5a2aab5e62c6b1de88991",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);