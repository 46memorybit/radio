// js/app.js
import { addSnippet, listSnippets, deleteAllSnippets, setKV, getKV } from './db.js';

const $ = (s)=>document.querySelector(s);
const els = {
  floatbar: $('#floatbar'),
  chipBar: $('#chipBar'),
  snipTitle: $('#snipTitle'),
  snipText: $('#snipText'),
  saveSnippetBtn: $('#saveSnippetBtn'),
  copyNowBtn: $('#copyNowBtn'),
  deleteAllSnippets: $('#deleteAllSnippets'),
  urlInput: $('#urlInput'),
  loadBtn: $('#loadBtn'),
  openNewBtn: $('#openNewBtn'),
  frame: $('#reqFrame'),
  installBtn: $('#installBtn'),
  exportBtn: $('#exportBtn'),
  toast: $('#toast')
};

let deferredPrompt = null;

/* ===== フローティングバーの高さを計測し、CSS変数に反映 ===== */
function updateFloatbarHeight(){
  const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  const h = (els.floatbar?.offsetHeight || 72) + safeTop;
  document.documentElement.style.setProperty('--floatbar-h', h + 'px');
}
addEventListener('resize', updateFloatbarHeight);
addEventListener('orientationchange', updateFloatbarHeight);

/* ===== PWA install ===== */
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (els.installBtn) els.installBtn.style.display = 'inline-block';
});
els.installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.style.display = 'none';
});

/* ===== init ===== */
(async function init() {
  await renderChips();
  await restoreURL();
  wireQuickButtons();
  updateFloatbarHeight();                // 初期表示時に反映
  // レイアウト変化を監視（チップ増減・折返しで高さが変わる）
  if (window.ResizeObserver && els.floatbar) {
    const ro = new ResizeObserver(updateFloatbarHeight);
    ro.observe(els.floatbar);
  }
})();

async function restoreURL(){
  const lastUrl = await getKV('last-url');
  if (lastUrl) {
    els.urlInput.value = lastUrl;
    setFrame(lastUrl);
  }
  const url = new URL(location.href).searchParams.get('url');
  if (url) {
    els.urlInput.value = url;
    await setKV('last-url', url);
    setFrame(url);
  }
}

/* ===== chips ===== */
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
      const list = await listSnippets();
      const hit = list.find(x => x.id === id);
      if (!hit) return;
      await writeClipboard(hit.text);
      toast('コピーしました');
    });
  });
}

/* ===== snippet add/copy ===== */
els.saveSnippetBtn.addEventListener('click', async () => {
  const title = els.snipTitle.value;
  const text  = els.snipText.value;
  if (!text.trim()) return alert('テキストを入力してください');
  await addSnippet({ title, text });
  els.snipText.value = '';
  await renderChips();
  updateFloatbarHeight(); // 高さ再計測
  toast('保存しました');
});

els.copyNowBtn.addEventListener('click', async () => {
  const txt = els.snipText.value.trim();
  if (!txt) return;
  await writeClipboard(txt);
  toast('コピーしました');
});

/* ===== delete all ===== */
els.deleteAllSnippets.addEventListener('click', async () => {
  if (!confirm('保存したテキストを全削除します。よろしいですか？')) return;
  await deleteAllSnippets();
  await renderChips();
  updateFloatbarHeight();
  toast('削除しました');
});

/* ===== quick buttons ===== */
function wireQuickButtons(){
  document.querySelectorAll('.quick').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const u = b.dataset.url;
      els.urlInput.value = u;
      await setKV('last-url', u);
      setFrame(u);
    });
  });
}

/* ===== load/open ===== */
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

/* ===== iframe ===== */
function setFrame(url) {
  els.frame.src = 'about:blank';
  const timer = setTimeout(()=>console.warn('Embedding may be blocked by the site.'), 10000);
  els.frame.onload = ()=> clearTimeout(timer);
  els.frame.src = url;
}

/* ===== clipboard / utils ===== */
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
function escapeHtml(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(()=>els.toast.classList.remove('show'), 1500);
}
