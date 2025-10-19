// js/db.js
export const DB_NAME = 'request-helper-db';
const DB_VERSION = 1;

// stores:
//   kv (key: string, value: any)  → { key, value }
//   snippets (id auto, title, text, createdAt)

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) {
        const kv = db.createObjectStore('kv', { keyPath: 'key' });
        kv.createIndex('key', 'key', { unique: true });
      }
      if (!db.objectStoreNames.contains('snippets')) {
        const s = db.createObjectStore('snippets', { keyPath: 'id', autoIncrement: true });
        s.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const st = tx.objectStore(store);
    const res = fn(st);
    tx.oncomplete = () => resolve(res);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// kv
export const setKV = (key, value) => run('kv', 'readwrite', (st) => st.put({ key, value }));
export const getKV = (key) =>
  run('kv', 'readonly', (st) => new Promise((resolve, reject) => {
    const r = st.get(key);
    r.onsuccess = () => resolve(r.result?.value ?? null);
    r.onerror = () => reject(r.error);
  }));

// snippets
export function addSnippet({ title, text }) {
  const doc = { title: title?.trim() || '', text: text?.trim() || '', createdAt: Date.now() };
  return run('snippets', 'readwrite', (st) => st.add(doc));
}
export function listSnippets() {
  return run('snippets', 'readonly', (st) => new Promise((resolve) => {
    const arr = [];
    const idx = st.index('createdAt');
    const cur = idx.openCursor(null, 'prev');
    cur.onsuccess = (e) => {
      const c = e.target.result;
      if (c) { arr.push(c.value); c.continue(); } else { resolve(arr); }
    };
  }));
}
export function deleteAllSnippets() {
  return run('snippets', 'readwrite', (st) => st.clear());
}
