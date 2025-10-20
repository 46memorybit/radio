// IndexedDB ラッパ（URLに title を保持）
const DB_NAME = 'request-pwa-db';
const DB_VER  = 3;
const STORE_TITLES = 'titles'; // {id, title, text, created}
const STORE_URLS   = 'urls';   // {id, url, title, order, created}

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
    const out = work(st);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
};

/* ===== Titles ===== */
export const addTitle = (title, text) =>
  txWrap(STORE_TITLES, 'readwrite', (st) => st.add({ title, text, created: Date.now() }));

export const listTitles = () =>
  txWrap(STORE_TITLES, 'readonly', (st) =>
    new Promise((resolve) => {
      const out = [];
      st.openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
      };
    })
  );

export const deleteTitle = (id) =>
  txWrap(STORE_TITLES, 'readwrite', (st) => st.delete(Number(id)));

export const clearTitles = () =>
  txWrap(STORE_TITLES, 'readwrite', (st) => st.clear());

/* ===== URLs ===== */
export const addUrl = async (url, title = null) => {
  const urls = await listUrls();
  const order = urls.length;
  return txWrap(STORE_URLS, 'readwrite', (st) =>
    st.add({ url, title, order, created: Date.now() })
  );
};

export const listUrls = () =>
  txWrap(STORE_URLS, 'readonly', (st) =>
    new Promise((resolve) => {
      const out = [];
      st.index('order').openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
      };
    })
  );

export const updateUrl = (id, patch) =>
  txWrap(STORE_URLS, 'readwrite', (st) =>
    new Promise((resolve, reject) => {
      const getReq = st.get(Number(id));
      getReq.onsuccess = () => {
        const cur = getReq.result;
        if (!cur) return resolve(false);
        const next = { ...cur, ...patch };
        const putReq = st.put(next);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    })
  );

export const deleteUrl = (id) =>
  txWrap(STORE_URLS, 'readwrite', (st) => st.delete(Number(id)));

export const clearUrls = () =>
  txWrap(STORE_URLS, 'readwrite', (st) => st.clear());

export const saveOrder = async (orderedIds) => {
  const all = await listUrls();
  const byId = new Map(all.map(v => [String(v.id), v]));
  const reordered = orderedIds.map((id, idx) => {
    const it = byId.get(String(id));
    return { ...it, order: idx };
  });
  return txWrap(STORE_URLS, 'readwrite', (st) => reordered.forEach(v => st.put(v)));
};
