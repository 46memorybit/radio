// js/app.js
/* ====== 永続化 ====== */
const LS_KEYS = {
  SNIPPETS: 'reqpwa.snippets.v1',
  URLS: 'reqpwa.urls.v1',
  URL_INDEX: 'reqpwa.urlIndex.v1',
  COLLAPSED: 'reqpwa.floatCollapsed.v1',
};

const DEFAULT_URLS = ['https://usen.oshireq.com/song/5731269'];

const load = (k, d) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : structuredClone(d); }
  catch { return structuredClone(d); }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ====== DOM取得 ====== */
const chipBar = document.getElementById('chipBar');
const deleteAllSnippetsBtn = document.getElementById('deleteAllSnippets');
const collapseBtn = document.getElementById('collapseBtn');
const floatBar = document.getElementById('floatBar');
const floatSpacer = document.getElementById('floatSpacer');
const toastEl = document.getElementById('toast');

const snipTitle = document.getElementById('snipTitle');
const snipText  = document.getElementById('snipText');
const saveSnippetBtn = document.getElementById('saveSnippetBtn');
const copyNowBtn = document.getElementById('copyNowBtn');

const urlInput = document.getElementById('urlInput');
const reqFrame = document.getElementById('reqFrame');
const loadBtn = document.getElementById('loadBtn');
const openNewBtn = document.getElementById('openNewBtn');

const prevUrlBtn = document.getElementById('prevUrlBtn');
const nextUrlBtn = document.getElementById('nextUrlBtn');
const indexBadge = document.getElementById('indexBadge');

const newUrlInput = document.getElementById('newUrlInput');
const addUrlBtn = document.getElementById('addUrlBtn');
const urlList = document.getElementById('urlList');
const quickBar = document.getElementById('quickBar');

const exportBtn = document.getElementById('exportBtn');
const installBtn = document.getElementById('installBtn');

/* ====== 状態 ====== */
let snippets = load(LS_KEYS.SNIPPETS, []);
let urls = (() => {
  const u = load(LS_KEYS.URLS, null);
  if (u === null || !Array.isArray(u) || u.length === 0) {
    save(LS_KEYS.URLS, DEFAULT_URLS);
    return [...DEFAULT_URLS];
  }
  return u;
})();
let urlIndex = Math.min(
  Math.max(0, Number(load(LS_KEYS.URL_INDEX, 0) ?? 0)),
  Math.max(0, urls.length - 1)
);

/* ====== ユーティリティ ====== */
const showToast = (msg = 'コピーしました') => {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1300);
};

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast();
  } catch (e) {
    console.error(e);
    showToast('コピーに失敗しました');
  }
};

const sanitizeUrl = (u) => {
  try { const x = new URL(u); return x.href; } catch { return null; }
};

/* ====== スニペット ====== */
const renderChips = () => {
  chipBar.innerHTML = '';
  if (snippets.length === 0) {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = 'まだ保存がありません。下のフォームから追加できます。';
    chipBar.appendChild(span);
    return;
  }
  snippets
    .slice() // 表示順＝作成の新しい順
    .sort((a,b)=>b.ts-a.ts)
    .forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.title = 'タップでコピー';
      chip.innerHTML = `<b>${s.title || '無題'}</b>`;
      chip.addEventListener('click', () => copy(s.text));
      chipBar.appendChild(chip);
    });
};

saveSnippetBtn.addEventListener('click', () => {
  const title = snipTitle.value.trim();
  const text  = snipText.value.trim();
  if (!text) return;
  const snip = { id: crypto.randomUUID(), title, text, ts: Date.now() };
  snippets.push(snip);
  save(LS_KEYS.SNIPPETS, snippets);
  renderChips();
  showToast('保存しました（上部からコピーできます）');
  // 入力は保持
});

copyNowBtn.addEventListener('click', () => {
  if (snipText.value.trim()) copy(snipText.value);
});

deleteAllSnippetsBtn.addEventListener('click', () => {
  if (!confirm('保存したテキストをすべて削除します。よろしいですか？')) return;
  snippets = [];
  save(LS_KEYS.SNIPPETS, snippets);
  renderChips();
});

collapseBtn.addEventListener('click', () => {
  const expanded = collapseBtn.getAttribute('aria-expanded') === 'true';
  collapseBtn.setAttribute('aria-expanded', String(!expanded));
  collapseBtn.textContent = expanded ? 'ひらく' : 'たたむ';
  chipBar.style.display = expanded ? 'none' : 'flex';
  floatSpacer.style.height = expanded ? '42px' : '72px';
  save(LS_KEYS.COLLAPSED, !expanded);
});

(() => { // 初期の開閉復元
  const collapsed = !!load(LS_KEYS.COLLAPSED, false);
  if (collapsed) {
    collapseBtn.setAttribute('aria-expanded', 'false');
    collapseBtn.textContent = 'ひらく';
    chipBar.style.display = 'none';
    floatSpacer.style.height = '42px';
  }
})();

/* ====== URL 管理 ====== */
const renderIndexBadge = () => {
  indexBadge.textContent = `${urls.length ? (urlIndex + 1) : 0} / ${urls.length}`;
};

const showUrlByIndex = (i) => {
  if (!urls.length) {
    urlIndex = 0;
    reqFrame.removeAttribute('src');
    urlInput.value = '';
    renderIndexBadge();
    return;
  }
  const len = urls.length;
  urlIndex = ((i % len) + len) % len; // 循環
  const u = urls[urlIndex];
  urlInput.value = u;
  reqFrame.src = u;
  save(LS_KEYS.URL_INDEX, urlIndex);
  renderIndexBadge();
};

const renderUrlQuick = () => {
  quickBar.innerHTML = '';
  urls.forEach((u, i) => {
    const btn = document.createElement('button');
    btn.className = 'ghost2';
    btn.textContent = `${i+1}. ${u}`;
    btn.addEventListener('click', () => showUrlByIndex(i));
    quickBar.appendChild(btn);
  });
};

const renderUrlList = () => {
  urlList.innerHTML = '';
  if (urls.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = '登録されたURLはありません。上の入力欄から追加できます。';
    urlList.appendChild(p);
    renderUrlQuick();
    renderIndexBadge();
    return;
  }

  urls.forEach((u, i) => {
    const row = document.createElement('div');
    row.className = 'url-item';

    const input = document.createElement('input');
    input.value = u;
    input.addEventListener('change', () => {
      const v = sanitizeUrl(input.value.trim());
      if (!v) { input.value = urls[i]; return; }
      urls[i] = v;
      save(LS_KEYS.URLS, urls);
      renderUrlQuick();
    });

    const actions = document.createElement('div');
    actions.className = 'url-actions';

    const btnShow = document.createElement('button');
    btnShow.className = 'ghost2';
    btnShow.textContent = '表示';
    btnShow.addEventListener('click', () => showUrlByIndex(i));

    const btnUp = document.createElement('button');
    btnUp.className = 'ghost2';
    btnUp.textContent = '↑';
    btnUp.title = '上へ';
    btnUp.addEventListener('click', () => {
      if (i === 0) return;
      [urls[i-1], urls[i]] = [urls[i], urls[i-1]];
      save(LS_KEYS.URLS, urls);
      // インデックス調整
      if (urlIndex === i) urlIndex = i - 1;
      else if (urlIndex === i - 1) urlIndex = i;
      save(LS_KEYS.URL_INDEX, urlIndex);
      renderUrlList();
      renderUrlQuick();
      renderIndexBadge();
    });

    const btnDown = document.createElement('button');
    btnDown.className = 'ghost2';
    btnDown.textContent = '↓';
    btnDown.title = '下へ';
    btnDown.addEventListener('click', () => {
      if (i === urls.length - 1) return;
      [urls[i+1], urls[i]] = [urls[i], urls[i+1]];
      save(LS_KEYS.URLS, urls);
      if (urlIndex === i) urlIndex = i + 1;
      else if (urlIndex === i + 1) urlIndex = i;
      save(LS_KEYS.URL_INDEX, urlIndex);
      renderUrlList();
      renderUrlQuick();
      renderIndexBadge();
    });

    const btnDel = document.createElement('button');
    btnDel.className = 'danger2';
    btnDel.textContent = '削除';
    btnDel.addEventListener('click', () => {
      if (!confirm('このURLを削除しますか？')) return;
      const removed = urls.splice(i, 1);
      save(LS_KEYS.URLS, urls);
      // index調整
      if (urls.length === 0) {
        urlIndex = 0;
      } else if (i < urlIndex) {
        urlIndex -= 1;
      } else if (i === urlIndex) {
        urlIndex = Math.min(urlIndex, urls.length - 1);
      }
      save(LS_KEYS.URL_INDEX, urlIndex);
      renderUrlList();
      renderUrlQuick();
      renderIndexBadge();
      // 表示を更新
      showUrlByIndex(urlIndex);
    });

    actions.append(btnShow, btnUp, btnDown, btnDel);
    row.append(input, actions);
    urlList.appendChild(row);
  });

  renderUrlQuick();
  renderIndexBadge();
};

// 追加
addUrlBtn.addEventListener('click', () => {
  const v = sanitizeUrl(newUrlInput.value.trim());
  if (!v) return;
  urls.push(v);
  save(LS_KEYS.URLS, urls);
  newUrlInput.value = '';
  renderUrlList();
  renderUrlQuick();
  renderIndexBadge();
  if (urls.length === 1) showUrlByIndex(0);
});

// 表示ボタン（入力欄から）
loadBtn.addEventListener('click', () => {
  const v = sanitizeUrl(urlInput.value.trim());
  if (!v) return;
  // 既存に同じURLがあればそこへジャンプ、なければ末尾に追加して移動
  let idx = urls.findIndex(x => x === v);
  if (idx === -1) {
    urls.push(v);
    save(LS_KEYS.URLS, urls);
    idx = urls.length - 1;
    renderUrlList();
    renderUrlQuick();
  }
  showUrlByIndex(idx);
});

// 新しいタブ
openNewBtn.addEventListener('click', () => {
  const v = sanitizeUrl(urlInput.value.trim());
  if (!v) return;
  window.open(v, '_blank', 'noopener,noreferrer');
});

// 前へ／次へ（循環）
prevUrlBtn.addEventListener('click', () => {
  if (!urls.length) return;
  showUrlByIndex(urlIndex - 1); // 先頭から前＝最後へ
});
nextUrlBtn.addEventListener('click', () => {
  if (!urls.length) return;
  showUrlByIndex(urlIndex + 1); // 最後から次＝先頭へ
});

/* ====== バックアップ ====== */
exportBtn.addEventListener('click', () => {
  const data = {
    exportedAt: new Date().toISOString(),
    snippets,
    urls,
    urlIndex
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reqpwa-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ====== インストールプロンプト ====== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.add('visible');
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.remove('visible');
});

/* ====== 初期描画 ====== */
renderChips();
renderUrlList();
if (urls.length) {
  // 初期表示：保存されたインデックス（範囲内に正規化）
  showUrlByIndex(urlIndex);
}
