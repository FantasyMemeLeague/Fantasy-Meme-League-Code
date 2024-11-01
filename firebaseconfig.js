// Import the necessary functions from Firebase SDK
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Add other services here as needed, but omit Authentication

import dotenv from 'dotenv';

// Firebase configuration object (values come from your .env file for security)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase with the config
const app = initializeApp(firebaseConfig);

// Initialize and export Firestore and Storage
const db = getFirestore(app);   // Firestore database
const storage = getStorage(app); // Firebase Storage

export { db, storage }; // Export only the initialized services you want
