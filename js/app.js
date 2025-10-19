// js/app.js
import {
  setSettings, getSettings,
  addPreset, listPresets, deleteAllPresets,
  addHistory, listHistory, deleteAllHistory
} from './db.js';

const $ = (sel) => document.querySelector(sel);

// 要素
const els = {
  station: $('#station'),
  name: $('#name'),
  signature: $('#signature'),
  template: $('#template'),
  freeTemplate: $('#freeTemplate'),

  title: $('#title'),
  artist: $('#artist'),
  reason: $('#reason'),

  genBtn: $('#genBtn'),
  savePresetBtn: $('#savePresetBtn'),
  clearBtn: $('#clearBtn'),

  result: $('#result'),
  copyBtn: $('#copyBtn'),
  copyDone: $('#copyDone'),
  saveHistoryBtn: $('#saveHistoryBtn'),
  shareBtn: $('#shareBtn'),

  presetList: $('#presetList'),
  historyList: $('#historyList'),

  exportBtn: $('#exportBtn'),
  deleteAllPresets: $('#deleteAllPresets'),
  deleteAllHistory: $('#deleteAllHistory'),

  installBtn: $('#installBtn')
};

let deferredPrompt = null;

// --- PWA Install
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.classList.add('visible');
});
els.installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.classList.remove('visible');
});

// --- 初期化
(async function init() {
  // 設定読み込み
  const s = await getSettings();
  if (s) {
    els.station.value = s.station || '';
    els.name.value = s.name || '';
    els.signature.value = s.signature || '';
    els.template.value = s.template || 'simple';
    els.freeTemplate.value = s.freeTemplate || '';
  }
  // リスト描画
  await renderLists();
})();

// --- 設定保存（入力変化の都度）
['station','name','signature','template','freeTemplate'].forEach((id) => {
  const el = els[id];
  el.addEventListener('change', persistSettings);
  el.addEventListener('input', debounce(persistSettings, 400));
});
async function persistSettings() {
  const settings = {
    station: els.station.value.trim(),
    name: els.name.value.trim(),
    signature: els.signature.value.trim(),
    template: els.template.value,
    freeTemplate: els.freeTemplate.value
  };
  await setSettings(settings);
}

// --- テキスト生成
els.genBtn.addEventListener('click', () => {
  const text = generateText();
  els.result.value = text;
  flashCopyDone(false);
});

function generateText() {
  const station = els.station.value.trim();
  const name = els.name.value.trim();
  const signature = els.signature.value.trim();
  const title = els.title.value.trim();
  const artist = els.artist.value.trim();
  const reason = els.reason.value.trim();
  const mode = els.template.value;
  const free = els.freeTemplate.value;

  // 共通部品
  const base = {
    station: station || 'ご担当者さま',
    name: name || '',
    signature: signature ? ` ${signature}` : ''
  };

  let body = '';
  if (mode === 'simple') {
    body = `${base.station}、${artist}「${title}」のオンエアをお願いします！${reason ? reason + ' ' : ''}（${base.name || '匿名'}）${base.signature}`;
  } else if (mode === 'push') {
    body = `${base.station} さま\n${artist}『${title}』をぜひ流してほしいです！\n理由：${reason || '魅力が伝わる一曲です！'}\n#推し活 ${base.signature}`.trim();
  } else if (mode === 'vote') {
    body = `${base.station} さま ${artist}「${title}」をお願いします！拡散＆投票の力で盛り上げたいです！${reason ? '\n' + reason : ''}\n${base.signature}`.trim();
  } else if (mode === 'free') {
    body = (free || '{station} さま、{artist}『{title}』をお願いします！{reason}（{name}）{signature}')
      .replaceAll('{station}', base.station)
      .replaceAll('{artist}', artist || 'アーティスト名')
      .replaceAll('{title}', title || '曲名')
      .replaceAll('{reason}', reason || '')
      .replaceAll('{name}', base.name || '匿名')
      .replaceAll('{signature}', base.signature);
  }

  return body;
}

// --- 1クリックコピー
els.copyBtn.addEventListener('click', async () => {
  const text = els.result.value;
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // フォールバック
      els.result.removeAttribute('readonly');
      els.result.select();
      document.execCommand('copy');
      els.result.setAttribute('readonly', 'true');
    }
    flashCopyDone(true);
  } catch (e) {
    alert('コピーに失敗しました：' + e.message);
  }
});
function flashCopyDone(ok) {
  els.copyDone.textContent = ok ? 'コピーしました！' : '';
  els.copyDone.classList.toggle('visible', ok);
  if (ok) setTimeout(() => els.copyDone.classList.remove('visible'), 2000);
}

// --- 共有（対応端末のみ）
els.shareBtn.addEventListener('click', async () => {
  const text = els.result.value;
  if (!text) return;
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (_) {}
  } else {
    alert('この端末/ブラウザはWeb Share APIに未対応です。コピーして貼り付けてください。');
  }
});

// --- プリセット保存
els.savePresetBtn.addEventListener('click', async () => {
  const payload = {
    title: els.title.value.trim(),
    artist: els.artist.value.trim(),
    reason: els.reason.value.trim()
  };
  if (!payload.title && !payload.artist) {
    alert('曲名またはアーティストを入力してください');
    return;
  }
  await addPreset(payload);
  await renderLists();
});

// --- 履歴保存
els.saveHistoryBtn.addEventListener('click', async () => {
  const text = els.result.value.trim();
  if (!text) return;
  await addHistory({
    text,
    meta: {
      title: els.title.value.trim(),
      artist: els.artist.value.trim(),
      station: els.station.value.trim()
    }
  });
  await renderLists();
});

// --- クリア
els.clearBtn.addEventListener('click', () => {
  ['title','artist','reason'].forEach(id => els[id].value = '');
  els.result.value = '';
  flashCopyDone(false);
});

// --- エクスポート（バックアップ）
els.exportBtn.addEventListener('click', async () => {
  const [presets, history, settings] = await Promise.all([listPresets(), listHistory(), getSettings()]);
  const blob = new Blob([JSON.stringify({ presets, history, settings, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gensen-backup-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// --- 全削除ボタン
els.deleteAllPresets.addEventListener('click', async () => {
  if (!confirm('プリセットを全削除します。よろしいですか？')) return;
  await deleteAllPresets();
  await renderLists();
});
els.deleteAllHistory.addEventListener('click', async () => {
  if (!confirm('履歴を全削除します。よろしいですか？')) return;
  await deleteAllHistory();
  await renderLists();
});

// --- リスト描画
async function renderLists() {
  const [presets, history] = await Promise.all([listPresets(), listHistory()]);
  // プリセット
  els.presetList.innerHTML = presets.map(p => `
    <div class="item">
      <div><span class="tag">${escapeHtml(p.artist||'')}</span><strong>${escapeHtml(p.title||'')}</strong></div>
      ${p.reason ? `<small>${escapeHtml(p.reason)}</small>` : ''}
      <div class="right">
        <button class="ghost" data-action="use-preset" data-id="${p.id}">呼び出し</button>
      </div>
    </div>
  `).join('') || '<div class="muted">まだありません</div>';

  // 履歴
  els.historyList.innerHTML = history.map(h => `
    <div class="item">
      <small>${new Date(h.createdAt).toLocaleString()}</small>
      <pre style="white-space:pre-wrap; font-family:inherit; margin:6px 0;">${escapeHtml(h.text)}</pre>
      <div class="right">
        <button class="ghost" data-action="copy-history" data-id="${h.id}">コピー</button>
      </div>
    </div>
  `).join('') || '<div class="muted">まだありません</div>';

  // デリゲート
  els.presetList.querySelectorAll('button[data-action="use-preset"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const p = presets.find(x => x.id === id);
      if (!p) return;
      els.title.value = p.title || '';
      els.artist.value = p.artist || '';
      els.reason.value = p.reason || '';
      // すぐ生成
      els.result.value = generateText();
      flashCopyDone(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  els.historyList.querySelectorAll('button[data-action="copy-history"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const h = history.find(x => x.id === id);
      if (!h) return;
      try {
        await navigator.clipboard.writeText(h.text);
        flashCopyDone(true);
      } catch (e) { alert('コピーに失敗：'+e.message); }
    });
  });
}

// --- utils
function escapeHtml(str='') {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
