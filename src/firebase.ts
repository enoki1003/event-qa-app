import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// 環境変数の貼り付け時に混入した前後の空白・タブを除く（authDomain に混入すると Google ログインが失敗する）
const env = (value: string | undefined) => value?.trim();

const firebaseConfig = {
  apiKey: env(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: env(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  databaseURL: env(import.meta.env.VITE_FIREBASE_DATABASE_URL),
  projectId: env(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: env(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: env(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: env(import.meta.env.VITE_FIREBASE_APP_ID),
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// 主催者として扱うメールドメイン。DBルール（database.rules.json）側でも同じドメインを強制している
export const HOST_EMAIL_DOMAIN = "rimo.app";
