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

  // ?url=...
  const url = new URL(location.href).searchParams.get('url');
  if (url) {
    els.urlInput.value = url;
    await setKV('last-url', url);
    setFrame(url);
  }
})();

// --- chips render（保存したテキスト → ワンタップ即コピー）
async function renderChips() {
  const items = await listSnippets();
  if (!items.length) {
    els.chipBar.innerHTML = '<span class="muted">まだ保存がありません。下のフォームから追加できます。</span>';
    return;
  }
  els.chipBar.innerHTML = items.map(it => `
    <button
      class="chip"
      type="button"
      data-id="${it.id}"
      data-text="${escapeAttr(it.text || '')}"
      aria-label="コピー: ${escapeAttr(it.title || '無題')}">
      <b>${escapeHtml(it.title || '無題')}</b>
    </button>
  `).join('');

  // pointerdown で確実に“ユーザー操作”として扱わせる（iOS/Android/PC統一）
  els.chipBar.addEventListener('pointerdown', async (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const text = btn.dataset.text || '';
    if (!text) return;

    try {
      await writeClipboard(text);
      toast('コピーしました');
    } catch (err) {
      // 最後の保険
      window.prompt('コピーできない場合は全選択してコピーしてください', text);
    }
  });
}

// --- snippet add / copy
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

// --- clipboard（HTTPS優先 → フォールバックは“画面内・透明”textarea）
async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) { /* fallthrough */ }
  }
  // 画面内・透明の textarea を一時生成（iOS PWAで安定しやすい）
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', 'true');
  Object.assign(ta.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '1px',
    height: '1px',
    opacity: '0',
    zIndex: '2147483647',
  });
  document.body.appendChild(ta);
  ta.focus({ preventScroll:true });
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('execCommand failed');
}

// --- utils
function escapeHtml(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function escapeAttr(s=''){return s.replace(/["&<>]/g,m=>({'"':'&quot;','&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
function toast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(()=>els.toast.classList.remove('show'), 1500);
}
