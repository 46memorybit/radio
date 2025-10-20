// db.js (ESM)
const DB_NAME = 'pwaStore';
const DB_VER = 1;
const STORE_TEXTS = 'texts';
const STORE_URLS  = 'urls';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TEXTS)) {
        const s = db.createObjectStore(STORE_TEXTS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_created', 'createdAt');
        s.createIndex('by_title', 'title');
      }
      if (!db.objectStoreNames.contains(STORE_URLS)) {
        const s = db.createObjectStore(STORE_URLS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_order', 'order');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const res = fn(s);
    t.oncomplete = () => resolve(res);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/* === TEXTS === */
export async function addText({ title, body }) {
  const createdAt = Date.now();
  return tx(STORE_TEXTS, 'readwrite', (s) => s.add({ title, body, createdAt }));
}
export async function getAllTexts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_TEXTS, 'readonly');
    const s = t.objectStore(STORE_TEXTS);
    const req = s.getAll();
    req.onsuccess = () => {
      const list = (req.result || []).sort((a,b)=> a.createdAt - b.createdAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}
export async function deleteText(id) {
  return tx(STORE_TEXTS, 'readwrite', (s) => s.delete(id));
}

/* === URLS === */
export async function addUrl({ url }) {
  const all = await getAllUrls();
  const maxOrder = all.reduce((m, x) => Math.max(m, x.order ?? 0), -1);
  const order = maxOrder + 1;
  return tx(STORE_URLS, 'readwrite', (s) => s.add({ url, order, createdAt: Date.now() }));
}
export async function getAllUrls() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_URLS, 'readonly');
    const s = t.objectStore(STORE_URLS);
    const req = s.getAll();
    req.onsuccess = () => {
      const list = (req.result || []).sort((a,b)=> (a.order ?? 0) - (b.order ?? 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}
export async function updateUrlOrder(id, newOrder) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_URLS, 'readwrite');
    const s = t.objectStore(STORE_URLS);
    const getReq = s.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return reject(new Error('not found'));
      item.order = newOrder;
      const putReq = s.put(item);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
export async function deleteUrl(id) {
  return tx(STORE_URLS, 'readwrite', (s) => s.delete(id));
}
