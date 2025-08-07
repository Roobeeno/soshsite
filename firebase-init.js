// Firebase v12 SDK imports with Analytics, Auth, and Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABMR6TojEP-rZhHmcr-un5d85HxWnhtAg",
  authDomain: "soshcommtracker.firebaseapp.com",
  projectId: "soshcommtracker",
  storageBucket: "soshcommtracker.firebasestorage.app",
  messagingSenderId: "302523035119",
  appId: "1:302523035119:web:ef2fc30ca29fb165001a1a",
  measurementId: "G-SJQ8R98XRS"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
