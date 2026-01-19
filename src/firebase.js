// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔥 Firebase Web 設定（來自你剛剛那頁）
const firebaseConfig = {
  apiKey: "AIzaSyA3j0fsAbAZig3COcEoDcQLRUh4bhtzEm4",
  authDomain: "tea-archive-pro.firebaseapp.com",
  projectId: "tea-archive-pro",
  storageBucket: "tea-archive-pro.firebasestorage.app",
  messagingSenderId: "752923936618",
  appId: "1:752923936618:web:d0f9208ef4bd11cd30c713",
  measurementId: "G-V58DV0EC1G"
};

// 初始化 Firebase
export const app = initializeApp(firebaseConfig);

// 匯出你會用到的服務
export const auth = getAuth(app);
export const db = getFirestore(app);
