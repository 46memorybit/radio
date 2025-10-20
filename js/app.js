// app.js (ESM)
import {
  addText, getAllTexts, deleteText,
  addUrl, getAllUrls, updateUrlOrder, deleteUrl
} from './db.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* UI要素 */
const titlePills = $('#titlePills');
const toast = $('#toast');

const titleInput = $('#titleInput');
const bodyInput  = $('#bodyInput');
const saveTextBtn = $('#saveTextBtn');
const clearTextBtn = $('#clearTextBtn');
const textList = $('#textList');

const urlInput = $('#urlInput');
const addUrlBtn = $('#addUrlBtn');
const urlList = $('#urlList');

const tabRegister = $('#tabRegister');
const tabRequest  = $('#tabRequest');
const sectionRegister = $('#sectionRegister');
const sectionRequest  = $('#sectionRequest');

const prevBtn = $('#prevBtn');
const nextBtn = $('#nextBtn');
const viewer  = $('#viewer');

let urlsCache = [];
let currentIndex = 0;

/* ===== ユーティリティ ===== */
function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> (toast.style.display='none'), 1200);
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('コピーしました');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    ta.remove();
    showToast('コピーしました');
  }
}

/* ===== タブ切替（登録 / リクエスト） ===== */
function selectTab(which) {
  const isReg = which === 'register';
  tabRegister.setAttribute('aria-selected', String(isReg));
  tabRequest.setAttribute('aria-selected', String(!isReg));
  sectionRegister.classList.toggle('active', isReg);
  sectionRequest.classList.toggle('active', !isReg);
}
tabRegister.addEventListener('click', () => selectTab('register'));
tabRequest.addEventListener('click', () => selectTab('request'));

/* ===== テキスト：保存／一覧／コピー／削除 ===== */
async function refreshTexts() {
  const list = await getAllTexts();
  // 上部ピル
  titlePills.innerHTML = '';
  for (const t of list) {
    const pill = document.createElement('button');
    pill.className = 'pill';
    pill.title = 'タップで本文をコピー';
    pill.textContent = t.title || '(無題)';
    pill.addEventListener('click', () => copyToClipboard(t.body || ''));
    titlePills.appendChild(pill);
  }
  // 下部一覧（登録カード内）
  textList.innerHTML = '';
  for (const t of list) {
    const wrap = document.createElement('div');
    wrap.className = 'item';
    const title = document.createElement('div');
    title.textContent = t.title || '(無題)';
    title.style.fontWeight = '600';
    title.style.opacity = '.95';
    title.style.cursor = 'pointer';
    title.title = 'タップで本文をコピー';
    title.addEventListener('click', () => copyToClipboard(t.body || ''));
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.textContent = '削除';
    del.addEventListener('click', async () => {
      await deleteText(t.id);
      await refreshTexts();
    });
    actions.appendChild(del);
    wrap.appendChild(title);
    wrap.appendChild(actions);
    textList.appendChild(wrap);
  }
}
saveTextBtn.addEventListener('click', async () => {
  const title = (titleInput.value || '').trim();
  const body  = (bodyInput.value || '').trim();
  if (!title && !body) { showToast('入力が空です'); return; }
  await addText({ title, body });
  titleInput.value = ''; bodyInput.value = '';
  await refreshTexts();
  showToast('保存しました');
});
clearTextBtn.addEventListener('click', () => {
  titleInput.value=''; bodyInput.value='';
});

/* ===== URL：追加／並べ替え／削除／iframe連動 ===== */
async function refreshUrls() {
  urlsCache = await getAllUrls();
  urlList.innerHTML = '';
  urlsCache.forEach((u, idx) => {
    const item = document.createElement('div');
    item.className = 'item';
    const urlDiv = document.createElement('div');
    urlDiv.className = 'item-url';
    urlDiv.textContent = u.url;
    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const up = document.createElement('button');
    up.className = 'icon-btn'; up.textContent = '▲';
    up.disabled = (idx === 0);
    up.addEventListener('click', async () => {
      await moveUrl(idx, -1);
    });
    const down = document.createElement('button');
    down.className = 'icon-btn'; down.textContent = '▼';
    down.disabled = (idx === urlsCache.length - 1);
    down.addEventListener('click', async () => {
      await moveUrl(idx, +1);
    });
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.textContent = '削除';
    del.addEventListener('click', async () => {
      await deleteUrl(u.id);
      await refreshUrls();
      ensureViewerIndex();
      renderViewer();
    });

    actions.appendChild(up);
    actions.appendChild(down);
    actions.appendChild(del);
    item.appendChild(urlDiv);
    item.appendChild(actions);
    urlList.appendChild(item);
  });

  ensureViewerIndex();
  renderViewer();
}
async function moveUrl(index, delta) {
  const target = urlsCache[index];
  const swap   = urlsCache[index + delta];
  if (!target || !swap) return;
  const tOrder = target.order ?? index;
  const sOrder = swap.order ?? (index + delta);
  await updateUrlOrder(target.id, sOrder);
  await updateUrlOrder(swap.id, tOrder);
  await refreshUrls();
}
addUrlBtn.addEventListener('click', async () => {
  const url = (urlInput.value || '').trim();
  if (!/^https?:\/\//i.test(url)) { showToast('URLを確認してください'); return; }
  await addUrl({ url });
  urlInput.value = '';
  await refreshUrls();
  showToast('追加しました');
});

function ensureViewerIndex() {
  if (urlsCache.length === 0) { currentIndex = -1; return; }
  if (currentIndex < 0 || currentIndex >= urlsCache.length) currentIndex = 0;
}
function renderViewer() {
  if (currentIndex < 0 || urlsCache.length === 0) {
    viewer.removeAttribute('src');
    viewer.title = 'URL未登録';
    return;
  }
  const url = urlsCache[currentIndex].url;
  viewer.src = url;
  viewer.title = `表示中: ${url}`;
}
prevBtn.addEventListener('click', () => {
  if (urlsCache.length === 0) return;
  currentIndex = (currentIndex - 1 + urlsCache.length) % urlsCache.length;
  renderViewer();
});
nextBtn.addEventListener('click', () => {
  if (urlsCache.length === 0) return;
  currentIndex = (currentIndex + 1) % urlsCache.length;
  renderViewer();
});

/* ===== 初期化 ===== */
(async function init() {
  await refreshTexts();
  await refreshUrls();
})();
