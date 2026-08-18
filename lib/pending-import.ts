'use client'

/**
 * Carries a PDF across the magic-link round trip.
 *
 * The landing page lets a visitor drop a PDF and see it as a real edition
 * before creating an account. Saving it then requires signing in, which means
 * leaving for an inbox and coming back through a full page load in what may be
 * a different tab — so the file has to survive outside the page's memory.
 *
 * IndexedDB rather than sessionStorage or a data URI: this is a binary blob of
 * up to 50 MB, and the string-based stores cap out an order of magnitude below
 * that. The raw PDF is stored rather than the rendered pages, because it is one
 * object instead of fifty and the import re-renders anyway.
 *
 * Everything here fails soft. A browser with IndexedDB disabled or a private
 * window that refuses to open a database should cost the visitor a re-upload,
 * not an error.
 */

const DB_NAME = 'qlico'
const STORE = 'pending-import'
const KEY = 'pdf'

/** Anything older than this is a stale artifact of an abandoned attempt. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

type StoredImport = { file: File; savedAt: number }

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, 1)
    } catch {
      return resolve(null)
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      request.onsuccess = () => resolve(request.result as T)
      request.onerror = () => resolve(null)
      tx.oncomplete = () => db.close()
    } catch {
      db.close()
      resolve(null)
    }
  })
}

export async function savePendingImport(file: File): Promise<boolean> {
  const payload: StoredImport = { file, savedAt: Date.now() }
  const result = await withStore<IDBValidKey>('readwrite', (store) => store.put(payload, KEY))
  return result !== null
}

export async function takePendingImport(): Promise<File | null> {
  const stored = await withStore<StoredImport | undefined>('readonly', (store) => store.get(KEY))
  if (!stored?.file) return null

  // Read-and-clear: a file left behind would re-open the import dialog on every
  // subsequent visit to the dashboard.
  await clearPendingImport()

  if (Date.now() - stored.savedAt > MAX_AGE_MS) return null
  return stored.file
}

export async function clearPendingImport(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(KEY))
}
