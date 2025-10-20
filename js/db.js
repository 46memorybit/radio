// IndexedDB ラッパ（ID返却を保証／即時反映用）
const DB_NAME = 'request-pwa-db';
const DB_VER  = 2;
const STORE_TITLES = 'titles'; // {id, title, text, created}
const STORE_URLS   = 'urls';   // {id, url, order, created}

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VER);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_TITLES)) {
      const s = db.createObjectStore(STORE_TITLES, { keyPath: 'id', autoIncrement: true });
      s.createIndex('created', 'created', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_URLS)) {
      const s = db.createObjectStore(STORE_URLS, { keyPath: 'id', autoIncrement: true });
      s.createIndex('order', 'order', { unique: false });
      s.createIndex('created', 'created', { unique: false });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror   = () => reject(req.error);
});

const txWrap = async (store, mode, work) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const st = tx.objectStore(store);
    work(st, resolve, reject);
    tx.onerror = () => reject(tx.error);
  });
};

/* ===== Titles ===== */
export const addTitle = (title, text) =>
  txWrap(STORE_TITLES, 'readwrite', (st, resolve, reject) => {
    const req = st.add({ title, text, created: Date.now() });
    req.onsuccess = () => resolve(req.result); // id を返す
    req.onerror   = () => reject(req.error);
  });

export const listTitles = () =>
  txWrap(STORE_TITLES, 'readonly', (st, resolve) => {
    const req = st.getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a,b)=>a.created-b.created));
  });

export const deleteTitle = (id) =>
  txWrap(STORE_TITLES, 'readwrite', (st, resolve) => {
    st.delete(Number(id)); resolve(true);
  });

export const clearTitles = () =>
  txWrap(STORE_TITLES, 'readwrite', (st, resolve) => { st.clear(); resolve(true); });

/* ===== URLs ===== */
export const addUrl = async (url) => {
  const urls = await listUrls();
  const order = urls.length;
  return txWrap(STORE_URLS, 'readwrite', (st, resolve, reject) => {
    const req = st.add({ url, order, created: Date.now() });
    req.onsuccess = () => resolve(req.result); // id
    req.onerror   = () => reject(req.error);
  });
};

export const listUrls = () =>
  txWrap(STORE_URLS, 'readonly', (st, resolve) => {
    const idx = st.index('order');
    const out = [];
    idx.openCursor().onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
    };
  });

export const deleteUrl = (id) =>
  txWrap(STORE_URLS, 'readwrite', (st, resolve) => { st.delete(Number(id)); resolve(true); });

export const clearUrls = () =>
  txWrap(STORE_URLS, 'readwrite', (st, resolve) => { st.clear(); resolve(true); });

export const saveOrder = async (orderedIds) => {
  const all = await listUrls();
  const map = new Map(all.map(v => [String(v.id), v]));
  const reordered = orderedIds.map((id, i) => ({ ...map.get(String(id)), order: i }));
  return txWrap(STORE_URLS, 'readwrite', (st, resolve) => {
    reordered.forEach(v => st.put(v));
    resolve(true);
  });
};

export const exportAll = async () => {
  const [titles, urls] = await Promise.all([listTitles(), listUrls()]);
  return { titles, urls };
};
