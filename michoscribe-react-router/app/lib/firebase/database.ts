import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  query,
  orderByChild,
  limitToLast,
  type Database,
  type DatabaseReference,
  type Query,
} from "firebase/database";
import { getFirebaseApp } from "./config";

let database: Database | null = null;

export function getFirebaseDatabase(): Database | null {
  if (typeof window === "undefined") return null;

  if (!database) {
    const app = getFirebaseApp();
    if (app) {
      database = getDatabase(app);
    }
  }
  return database;
}

export function getDbRef(path: string): DatabaseReference | null {
  const db = getFirebaseDatabase();
  if (!db) return null;
  return ref(db, path);
}

// Write data to a path
export async function writeData<T>(path: string, data: T): Promise<void> {
  const dbRef = getDbRef(path);
  if (!dbRef) throw new Error("Database not initialized");
  return set(dbRef, data);
}

// Read data from a path
export async function readData<T>(path: string): Promise<T | null> {
  const dbRef = getDbRef(path);
  if (!dbRef) throw new Error("Database not initialized");
  const snapshot = await get(dbRef);
  return snapshot.exists() ? (snapshot.val() as T) : null;
}

// Push data to a list (generates unique key)
export async function pushData<T>(path: string, data: T): Promise<string> {
  const dbRef = getDbRef(path);
  if (!dbRef) throw new Error("Database not initialized");
  const newRef = push(dbRef);
  await set(newRef, data);
  return newRef.key!;
}

// Update specific fields at a path
export async function updateData(
  path: string,
  updates: Record<string, unknown>
): Promise<void> {
  const dbRef = getDbRef(path);
  if (!dbRef) throw new Error("Database not initialized");
  return update(dbRef, updates);
}

// Delete data at a path
export async function deleteData(path: string): Promise<void> {
  const dbRef = getDbRef(path);
  if (!dbRef) throw new Error("Database not initialized");
  return remove(dbRef);
}

// Subscribe to real-time updates
export function subscribeToData<T>(
  path: string,
  callback: (data: T | null) => void
): () => void {
  console.log(`[Firebase DB] Subscribing to path: ${path}`);

  const dbRef = getDbRef(path);
  if (!dbRef) {
    console.warn(`[Firebase DB] Could not get ref for path: ${path}`);
    callback(null);
    return () => {};
  }

  const unsubscribe = onValue(
    dbRef,
    (snapshot) => {
      console.log(`[Firebase DB] Data received for ${path}:`, snapshot.exists() ? 'has data' : 'empty');
      callback(snapshot.exists() ? (snapshot.val() as T) : null);
    },
    (error) => {
      console.error(`[Firebase DB] Error subscribing to ${path}:`, error.message);
      callback(null);
    }
  );

  return unsubscribe;
}

// Query data with ordering
export function createQuery(
  path: string,
  orderBy: string,
  limit?: number
): Query | null {
  const dbRef = getDbRef(path);
  if (!dbRef) return null;

  let q = query(dbRef, orderByChild(orderBy));
  if (limit) {
    q = query(dbRef, orderByChild(orderBy), limitToLast(limit));
  }
  return q;
}

export type { DatabaseReference, Query };
