// IndexedDB storage for worlds. Nothing here ever leaves the device.

const DB_NAME = 'zzworld';
const DB_VERSION = 1;
const WORLDS = 'worlds';

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORLDS)) db.createObjectStore(WORLDS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORLDS, mode);
    const request = fn(tx.objectStore(WORLDS));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadWorld(id) {
  return (await withStore('readonly', (store) => store.get(id))) ?? null;
}

export function saveWorld(world) {
  return withStore('readwrite', (store) => store.put(world));
}

export function listWorlds() {
  return withStore('readonly', (store) => store.getAll());
}

export function deleteWorld(id) {
  return withStore('readwrite', (store) => store.delete(id));
}

// Asks the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
