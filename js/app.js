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
  toast: $('#toast')
};

let deferredPrompt = null;

/* ---------- 高さ同期 ---------- */
const ro = new ResizeObserver(() => syncSpacer());
ro.observe(els.floatBar);
function syncSpacer() {
  const h = Math.ceil(els.floatBar.getBoundingClientRect().height);
  els.floatSpacer.style.height = `${h}px`;
}
syncSpacer();

/* ---------- 折りたたみ ---------- */
let collapsed = false;
els.collapseBtn?.addEventListener('click', () => {
  collapsed = !collapsed;
  els.chipBar.style.display = collapsed ? 'none' : 'flex';
  els.collapseBtn.textContent = collapsed ? 'ひらく' : 'たたむ';
  els.collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  syncSpacer();
});

/* ---------- PWA install ---------- */
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

/* ---------- init ---------- */
(async function init() {
  const lastUrl = await getKV('last-url');
  if (lastUrl) {
    els.urlInput.value = lastUrl;
    setFrame(lastUrl);
  }
  await renderChips();
})();

/* ---------- 保存したテキスト描画（タイトルのみ表示・タップでコピー） ---------- */
async function renderChips() {
  const items = await listSnippets();
  if (!items.length) {
    els.chipBar.innerHTML = '<span class="muted">まだ保存がありません。</span>';
    return;
  }
  els.chipBar.innerHTML = items.map(it => `
    <div class="chip" role="button" tabindex="0"
         title="タップでコピー"
         data-text="${escapeHtml(it.text).replace(/"/g,'&quot;')}">
      <b>${escapeHtml(it.title || '無題')}</b>
    </div>
  `).join('');
}

/* ---------- ワンタップでコピー ---------- */
els.chipBar.addEventListener('pointerup', onChipActivate, { passive: true });
els.chipBar.addEventListener('click', onChipActivate);
els.chipBar.addEventListener('keydown', (e) => {
  if (e.target.classList.contains('chip') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    onChipActivate(e);
  }
});
async function onChipActivate(e) {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const text = chip.getAttribute('data-text') || '';
  if (!text) return;
  await writeClipboard(text);
  if (navigator.vibrate) navigator.vibrate(10);
  toast('コピーしました');
}

/* ---------- 保存/コピー ---------- */
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

/* ---------- 削除 ---------- */
els.deleteAllSnippets.addEventListener('click', async () => {
  if (!confirm('保存したテキストを全削除します。よろしいですか？')) return;
  await deleteAllSnippets();
  await renderChips();
  toast('削除しました');
});

/* ---------- iframe表示 ---------- */
document.querySelectorAll('.quick').forEach(b=>{
  b.addEventListener('click', async ()=>{
    const u = b.dataset.url;
    els.urlInput.value = u;
    await setKV('last-url', u);
    setFrame(u);
  });
});
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
function setFrame(url) {
  els.frame.src = 'about:blank';
  els.frame.src = url;
}

/* ---------- クリップボード処理（確実にフォールバック） ---------- */
async function writeClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    throw new Error('Clipboard API unavailable');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    document.execCommand('copy');
    ta.remove();
  }
}

/* ---------- utils ---------- */
function escapeHtml(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(()=>els.toast.classList.remove('show'), 1500);
}
