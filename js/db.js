// js/db.js
// IndexedDB schema: "gensen-db" v1
// stores:
//   - settings(key: 'settings'): { station, name, signature, template, freeTemplate }
//   - presets: { id, title, artist, reason, createdAt }
//   - history: { id, text, meta: {title, artist, station}, createdAt }

export const DB_NAME = 'gensen-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('kv')) {
        const kv = db.createObjectStore('kv', { keyPath: 'key' });
        kv.createIndex('key', 'key', { unique: true });
      }
      if (!db.objectStoreNames.contains('presets')) {
        const store = db.createObjectStore('presets', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('history')) {
        const store = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const res = fn(store);
    tx.oncomplete = () => resolve(res);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// KV (settings)
export async function setSettings(settings) {
  return tx('kv', 'readwrite', (store) => store.put({ key: 'settings', value: settings }));
}
export async function getSettings() {
  return tx('kv', 'readonly', (store) => new Promise((resolve, reject) => {
    const r = store.get('settings');
    r.onsuccess = () => resolve(r.result?.value || null);
    r.onerror = () => reject(r.error);
  }));
}

// Presets
export async function addPreset(preset) {
  preset.createdAt = Date.now();
  return tx('presets', 'readwrite', (store) => store.add(preset));
}
export async function listPresets() {
  return tx('presets', 'readonly', (store) => new Promise((resolve) => {
    const arr = [];
    const idx = store.index('createdAt');
    const req = idx.openCursor(null, 'prev');
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { arr.push(cur.value); cur.continue(); } else { resolve(arr); }
    };
  }));
}
export async function deleteAllPresets() {
  return tx('presets', 'readwrite', (store) => store.clear());
}

// History
export async function addHistory(item) {
  item.createdAt = Date.now();
  return tx('history', 'readwrite', (store) => store.add(item));
}
export async function listHistory() {
  return tx('history', 'readonly', (store) => new Promise((resolve) => {
    const arr = [];
    const idx = store.index('createdAt');
    const req = idx.openCursor(null, 'prev');
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { arr.push(cur.value); cur.continue(); } else { resolve(arr); }
    };
  }));
}
export async function deleteAllHistory() {
  return tx('history', 'readwrite', (store) => store.clear());
}
