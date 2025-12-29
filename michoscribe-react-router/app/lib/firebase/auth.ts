import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseApp } from "./config";

let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") return null;

  if (!auth) {
    const app = getFirebaseApp();
    if (app) {
      auth = getAuth(app);
    }
  }
  return auth;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Auth not initialized");

  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Auth not initialized");

  await setPersistence(auth, browserLocalPersistence);
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginAnonymously(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Auth not initialized");

  return signInAnonymously(auth);
}

export async function logout(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Auth not initialized");

  return signOut(auth);
}

export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export type { User, UserCredential };
