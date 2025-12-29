import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  type FirebaseStorage,
  type StorageReference,
  type UploadTask,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { getFirebaseApp } from "./config";

let storage: FirebaseStorage | null = null;

export function getFirebaseStorage(): FirebaseStorage | null {
  if (typeof window === "undefined") return null;

  if (!storage) {
    const app = getFirebaseApp();
    if (app) {
      storage = getStorage(app);
    }
  }
  return storage;
}

export function getStorageRef(path: string): StorageReference | null {
  const store = getFirebaseStorage();
  if (!store) return null;
  return ref(store, path);
}

// Upload a file and return the download URL
export async function uploadFile(path: string, file: File): Promise<string> {
  const storageRef = getStorageRef(path);
  if (!storageRef) throw new Error("Storage not initialized");

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// Upload with progress tracking
export function uploadFileWithProgress(
  path: string,
  file: File,
  onProgress?: (progress: number) => void,
  onError?: (error: Error) => void,
  onComplete?: (downloadUrl: string) => void
): UploadTask {
  const storageRef = getStorageRef(path);
  if (!storageRef) throw new Error("Storage not initialized");

  const task = uploadBytesResumable(storageRef, file);

  task.on(
    "state_changed",
    (snapshot: UploadTaskSnapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress?.(progress);
    },
    (error) => {
      onError?.(error);
    },
    async () => {
      const downloadUrl = await getDownloadURL(storageRef);
      onComplete?.(downloadUrl);
    }
  );

  return task;
}

// Get download URL for a file
export async function getFileUrl(path: string): Promise<string> {
  const storageRef = getStorageRef(path);
  if (!storageRef) throw new Error("Storage not initialized");

  return getDownloadURL(storageRef);
}

// Delete a file
export async function deleteFile(path: string): Promise<void> {
  const storageRef = getStorageRef(path);
  if (!storageRef) throw new Error("Storage not initialized");

  return deleteObject(storageRef);
}

// List all files in a directory
export async function listFiles(
  path: string
): Promise<{ name: string; fullPath: string }[]> {
  const storageRef = getStorageRef(path);
  if (!storageRef) throw new Error("Storage not initialized");

  const result = await listAll(storageRef);
  return result.items.map((item) => ({
    name: item.name,
    fullPath: item.fullPath,
  }));
}

export type { StorageReference, UploadTask };
