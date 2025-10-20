// IndexedDB ラッパー
const DB_NAME = 'request-pwa-db';
const DB_VER = 1;
const STORE_TITLES = 'titles'; // {id, title, text, created}
const STORE_URLS   = 'urls';   // {id, url, order, created}

const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
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
    req.onerror = () => reject(req.error);
  });

const withStore = async (store, mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const st = tx.objectStore(store);
    const result = fn(st);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
};

// ---- Titles ----
export const addTitle = (title, text) =>
  withStore(STORE_TITLES, 'readwrite', (st) =>
    st.add({ title, text, created: Date.now() })
  );

export const listTitles = () =>
  withStore(STORE_TITLES, 'readonly', (st) =>
    new Promise((resolve) => {
      const out = [];
      st.openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
      };
    })
  );

export const deleteTitle = (id) =>
  withStore(STORE_TITLES, 'readwrite', (st) => st.delete(id));

export const clearTitles = () =>
  withStore(STORE_TITLES, 'readwrite', (st) => st.clear());

// ---- URLs ----
export const addUrl = async (url) => {
  const urls = await listUrls();
  const order = urls.length; // 末尾に
  return withStore(STORE_URLS, 'readwrite', (st) =>
    st.add({ url, order, created: Date.now() })
  );
};

export const listUrls = () =>
  withStore(STORE_URLS, 'readonly', (st) =>
    new Promise((resolve) => {
      const out = [];
      st.index('order').openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
      };
    })
  );

export const deleteUrl = async (id) => {
  const urls = await listUrls();
  await withStore(STORE_URLS, 'readwrite', (st) => st.delete(id));
  // order 再採番
  const remains = (await listUrls()).sort((a,b)=>a.order-b.order).map((v, i) => ({...v, order: i}));
  await withStore(STORE_URLS, 'readwrite', (st) => remains.forEach(v => st.put(v)));
};

export const clearUrls = () =>
  withStore(STORE_URLS, 'readwrite', (st) => st.clear());

export const saveOrder = async (orderedIds) => {
  const all = await listUrls();
  const byId = new Map(all.map(v => [String(v.id), v]));
  const reordered = orderedIds.map((id, idx) => {
    const it = byId.get(String(id));
    return { ...it, order: idx };
  });
  await withStore(STORE_URLS, 'readwrite', (st) => reordered.forEach(v => st.put(v)));
};

export const exportAll = async () => {
  const [titles, urls] = await Promise.all([listTitles(), listUrls()]);
  return { titles, urls };
};
