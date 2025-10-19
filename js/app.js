// js/app.js
import { addSnippet, listSnippets, deleteAllSnippets, setKV, getKV } from './db.js';

const $ = (s)=>document.querySelector(s);
const els = {
  floatBar: $('#floatBar'),
  floatSpacer: $('#floatSpacer'),
  chipBar: $('#chipBar'),
  snipTitle: $('#snipTitle'),
  snipText: $('#snipText'),
  saveSnippetBtn: $('#saveSnippetBtn'),
  copyNowBtn: $('#copyNowBtn'),
  deleteAllSnippets: $('#deleteAllSnippets'),
  collapseBtn: $('#collapseBtn'),
  urlInput: $('#urlInput'),
  loadBtn: $('#loadBtn'),
  openNewBtn: $('#openNewBtn'),
  frame: $('#reqFrame'),
  installBtn: $('#installBtn'),
  exportBtn: $('#exportBtn'),
  toast: $('#toast'),
  copyHelper: $('#copyHelper'),
};

let deferredPrompt = null;

// ---- フローティングバー高さ → スペーサ反映
const ro = new ResizeObserver(() => syncSpacer());
ro.observe(els.floatBar);
function syncSpacer() {
  const h = Math.ceil(els.floatBar.getBoundingClientRect().height);
  els.floatSpacer.style.height = `${h}px`;
}
syncSpacer();

// ---- 折りたたみ
let collapsed = false;
els.collapseBtn?.addEventListener('click', () => {
  collapsed = !collapsed;
  els.chipBar.style.display = collapsed ? 'none' : 'flex';
  els.collapseBtn.textContent = collapsed ? 'ひらく' : 'たたむ';
  els.collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  syncSpacer();
});

// --- PWA install
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn?.classList.add('visible');
});
els.installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn?.classList.remove('visible');
});

// --- init
(async function init() {
  const lastUrl = await getKV('last-url');
  if (lastUrl) {
    els.urlInput.value = lastUrl;
    setFrame(lastUrl);
  }
  await renderChips();

  // URLクエリ ?url=...
  const url = new URL(location.href).searchParams.get('url');
  if (url) {
    els.urlInput.value = url;
    await setKV('last-url', url);
    setFrame(url);
  }
})();

// --- chips render（スマホ：touchstart対応、チップ全体＝コピー）
async function renderChips() {
  const items = await listSnippets();
  if (!items.length) {
    els.chipBar.innerHTML = '<span class="muted">まだ保存がありません。下のフォームから追加できます。</span>';
    return;
  }
  els.chipBar.innerHTML = items.map(it => `
    <button class="chip" type="button" data-id="${it.id}" aria-label="コピー: ${escapeHtml(it.title || '無題')}">
      <b>${escapeHtml(it.title || '無題')}</b>
    </button>
  `).join('');

  // touchstart + click の両対応（ダブル発火ガード）
  let ignoreClickUntil = 0;
  const tapHandler = async (e) => {
    if (e.type === 'click' && Date.now() < ignoreClickUntil) return;
    if (e.type === 'touchstart') ignoreClickUntil = Date.now() + 600;

    const btn = e.target.closest('.chip');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const fresh = await listSnippets();
    const hit = fresh.find(x => x.id === id);
    if (!hit) return;

    try {
      await writeClipboard(hit.text);
      toast('コピーしました');
    } catch (err) {
      window.prompt('コピーできない場合は全選択してコピーしてください', hit.text);
    }
  };
  els.chipBar.addEventListener('touchstart', tapHandler, { passive: true });
  els.chipBar.addEventListener('click', tapHandler);
}

// --- snippet add/copy
els.saveSnippetBtn.addEventListener('click', async () => {
  const title = els.snipTitle.value;
  const text  = els.snipText.value;
  if (!text.trim()) return alert('テキストを入力してください');
  await addSnippet({ title, text });
  els.snipText.value = '';
  await renderChips();
  toast('保存しました');
});
els.copyNowBtn.addEventListener('click', async () => {
  const txt = els.snipText.value.trim();
  if (!txt) return;
  await writeClipboard(txt);
  toast('コピーしました');
});

// --- delete all
els.deleteAllSnippets.addEventListener('click', async () => {
  if (!confirm('保存したテキストを全削除します。よろしいですか？')) return;
  await deleteAllSnippets();
  await renderChips();
  toast('削除しました');
});

// --- quick buttons
document.querySelectorAll('.quick').forEach(b=>{
  b.addEventListener('click', async ()=>{
    const u = b.dataset.url;
    els.urlInput.value = u;
    await setKV('last-url', u);
    setFrame(u);
  });
});

// --- load/open
els.loadBtn.addEventListener('click', async () => {
  const u = els.urlInput.value.trim();
  if (!u) return;
  await setKV('last-url', u);
  setFrame(u);
});
els.openNewBtn.addEventListener('click', () => {
  const u = els.urlInput.value.trim();
  if (u) window.open(u, '_blank', 'noopener');
});

// --- iframe
function setFrame(url) {
  els.frame.src = 'about:blank';
  const fallbackTimer = setTimeout(()=>{
    console.warn('Embedding may be blocked by the site.');
  }, 10000);
  els.frame.onload = ()=> clearTimeout(fallbackTimer);
  els.frame.src = url;
}

// --- clipboard（強化：HTTPS / PWA / iOSフォールバック）
async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) { /* fallthrough */ }
  }
  // フォールバック：不可視textareaに書き込んで選択→コピー
  const ta = els.copyHelper;
  ta.value = text;
  ta.removeAttribute('readonly'); // iOS対策：選択可能に
  ta.focus({ preventScroll:true });
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  const ok = document.execCommand('copy');
  ta.setAttribute('readonly', 'true');
  if (!ok) throw new Error('execCommand failed');
}

// --- export backup
els.exportBtn?.addEventListener('click', async () => {
  const [snips, lastUrl] = [await listSnippets(), await getKV('last-url')];
  const blob = new Blob([JSON.stringify({ snips, lastUrl, exportedAt:new Date().toISOString() }, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `request-helper-backup-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// --- utils
function escapeHtml(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(()=>els.toast.classList.remove('show'), 1500);
}
