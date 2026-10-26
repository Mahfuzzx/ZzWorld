// IndexedDB storage. Nothing here ever leaves the device.
//   worlds — saved game worlds
//   defs   — definitions made in ZzStudio or imported from .zzpack files

const DB_NAME = 'zzworld';
const DB_VERSION = 2;
const WORLDS = 'worlds';
const DEFS = 'defs';

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORLDS)) db.createObjectStore(WORLDS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DEFS)) db.createObjectStore(DEFS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const request = fn(tx.objectStore(name));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadWorld(id) {
  return (await withStore(WORLDS, 'readonly', (store) => store.get(id))) ?? null;
}

export function saveWorld(world) {
  return withStore(WORLDS, 'readwrite', (store) => store.put(world));
}

export function listWorlds() {
  return withStore(WORLDS, 'readonly', (store) => store.getAll());
}

export function deleteWorld(id) {
  return withStore(WORLDS, 'readwrite', (store) => store.delete(id));
}

export function listDefs() {
  return withStore(DEFS, 'readonly', (store) => store.getAll());
}

export function saveDef(def) {
  return withStore(DEFS, 'readwrite', (store) => store.put(def));
}

export function deleteDef(id) {
  return withStore(DEFS, 'readwrite', (store) => store.delete(id));
}

// Asks the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
