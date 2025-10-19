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
  toast: $('#toast')
};

let deferredPrompt = null;

// ---- フローティングバー高さをスペーサへ反映
const ro = new ResizeObserver(() => syncSpacer());
ro.observe(els.floatBar);
function syncSpacer() {
  // safe-area-inset-top 分を含む実測高さ
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

// --- chips render
async function renderChips() {
  const items = await listSnippets();
  if (!items.length) {
    els.chipBar.innerHTML = '<span class="muted">まだ保存がありません。下のフォームから追加できます。</span>';
    return;
  }
  els.chipBar.innerHTML = items.map(it => `
    <div class="chip">
      <b>${escapeHtml(it.title || '無題')}</b>
      <button class="copy" data-id="${it.id}">コピー</button>
    </div>
  `).join('');
  els.chipBar.querySelectorAll('button.copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const items2 = await listSnippets();
      const hit = items2.find(x => x.id === id);
      if (!hit) return;
      await writeClipboard(hit.text);
      toast('コピーしました');
    });
  });
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

// --- clipboard
async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
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
