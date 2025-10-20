export const App = (() => {
  let DB, SortableLib;
  const qs = (s) => document.querySelector(s);
  let el = {};
  let state = { titles: [], urls: [], currentIndex: 0 };

  /* ---------- helpers ---------- */
  const toast = (msg) => {
    const t = el.toast; t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1200);
  };
  const escapeHtml = (s='') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hostnameOf = (url) => { try { return new URL(url).hostname; } catch { return url; } };

  // ページタイトル取得（CORS通過時のみHTML解析）
  const fetchPageTitle = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { mode: 'cors', signal: controller.signal, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) throw new Error('not html');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const og = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
      const tw = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
      const tt = doc.querySelector('title')?.textContent;
      const title = (og || tw || tt || '').trim();
      if (title) return title;
      return hostnameOf(url);
    } catch {
      const h = hostnameOf(url);
      return h && h !== url ? h : url;
    } finally { clearTimeout(timer); }
  };

  /* ---------- renderers ---------- */
  const renderTitles = () => {
    const list = el.copyList; list.innerHTML = '';
    state.titles.forEach((it) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill';
      btn.title = 'タップでコピー';
      btn.dataset.id = it.id;
      btn.innerHTML = `<span>${escapeHtml(it.title || '(無題)')}</span><small>コピー</small>`;
      btn.addEventListener('click', async () => {
        const text = it.text || '';
        try { await navigator.clipboard.writeText(text); }
        catch {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove();
        }
        toast('コピーしました');
      });
      // 長押し削除（確認付き）
      let timer = null;
      btn.addEventListener('mousedown', () => {
        timer = setTimeout(async () => {
          if (confirm('このタイトルを削除しますか？')) { await DB.deleteTitle(it.id); await loadTitles(); }
        }, 700);
      });
      ['mouseup','mouseleave','touchend','touchcancel'].forEach(e => btn.addEventListener(e, () => clearTimeout(timer)));
      list.appendChild(btn);
    });
    el.copyCount.textContent = `${state.titles.length} 件`;
  };

  const renderUrlList = () => {
    const list = el.urlList; list.innerHTML = '';
    state.urls.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'url-item';
      row.dataset.id = it.id;

      const main = document.createElement('div'); main.className = 'url-main';
      const title = document.createElement('div'); title.className = 'url-title';
      title.textContent = it.title || hostnameOf(it.url) || '(タイトル取得中)';
      const sub = document.createElement('div'); sub.className = 'url-sub';
      sub.textContent = it.url;
      main.appendChild(title); main.appendChild(sub);

      const goBtn = document.createElement('button'); goBtn.type='button'; goBtn.className='btn'; goBtn.textContent='表示';
      goBtn.addEventListener('click', () => goToUrlId(it.id));

      const del = document.createElement('button'); del.type='button'; del.className='btn'; del.textContent='削除';
      del.addEventListener('click', async () => {
        if (!confirm('このURLを削除しますか？')) return;
        await DB.deleteUrl(it.id);
        await resequence(); await loadUrls(true);
        toast('削除しました');
      });

      const handle = document.createElement('div'); handle.className = 'handle'; handle.title = 'ドラッグで並べ替え';

      row.append(main, goBtn, del, handle);
      list.appendChild(row);
    });

    // SortableJS 初期化（1回だけ）: 右端≡をハンドルに
    if (!list._sortable && SortableLib) {
      list._sortable = SortableLib.create(list, {
        animation: 150,
        handle: '.handle',
        ghostClass: 'dragging',
        onEnd: async () => {
          const newOrder = Array.from(list.children).map(li => li.dataset.id);
          await DB.saveOrder(newOrder);
          await loadUrls(true);
          toast('並び順を保存しました');
        }
      });
    }
  };

  const updateViewer = () => {
    const n = state.urls.length;
    if (!n) { el.viewer.src = 'about:blank'; return; }
    if (state.currentIndex < 0) state.currentIndex = 0;
    if (state.currentIndex >= n) state.currentIndex = n - 1;
    el.viewer.src = state.urls[state.currentIndex].url;
  };
  const goPrev = () => { if (!state.urls.length) return; state.currentIndex = (state.currentIndex - 1 + state.urls.length) % state.urls.length; updateViewer(); };
  const goNext = () => { if (!state.urls.length) return; state.currentIndex = (state.currentIndex + 1) % state.urls.length; updateViewer(); };
  const goToUrlId = (id) => { const i = state.urls.findIndex(u => u.id === id); if (i >= 0) { state.currentIndex = i; updateViewer(); } };

  /* ---------- IO ---------- */
  const loadTitles = async () => { state.titles = await DB.listTitles(); renderTitles(); };
  const loadUrls   = async (keepIndex=false) => {
    const curId = state.urls[state.currentIndex]?.id;
    state.urls = await DB.listUrls(); renderUrlList();
    if (keepIndex && curId) {
      const i = state.urls.findIndex(u => u.id === curId);
      state.currentIndex = i >= 0 ? i : 0;
    } else {
      state.currentIndex = 0;
    }
    updateViewer();
  };
  const resequence = async () => {
    const ids = (await DB.listUrls()).sort((a,b)=>a.order-b.order).map(v=>v.id);
    await DB.saveOrder(ids);
  };

  /* ---------- init ---------- */
  const init = ({ DB: db, Sortable }) => {
    DB = db;
    SortableLib = Sortable;

    el = {
      copyList: qs('#copyList'), copyCount: qs('#copyCount'),
      titleInput: qs('#titleInput'), textInput: qs('#textInput'), saveTextBtn: qs('#saveTextBtn'),
      exportTextBtn: qs('#exportTextBtn'), clearTextBtn: qs('#clearTextBtn'),
      urlInput: qs('#urlInput'), addUrlBtn: qs('#addUrlBtn'),
      exportUrlBtn: qs('#exportUrlBtn'), clearUrlBtn: qs('#clearUrlBtn'),
      urlList: qs('#urlList'),
      prevBtn: qs('#prevBtn'), nextBtn: qs('#nextBtn'),
      viewer: qs('#viewer'), toast: qs('#toast'),
    };

    // テキスト保存
    el.saveTextBtn.addEventListener('click', async () => {
      const title = el.titleInput.value.trim(); const text = el.textInput.value;
      if (!title) return toast('タイトルを入力してください');
      await DB.addTitle(title, text);
      el.titleInput.value = ''; el.textInput.value = '';
      await loadTitles(); toast('保存しました');
    });

    el.clearTextBtn.addEventListener('click', async () => {
      if (confirm('テキストを全削除しますか？')) { await DB.clearTitles(); await loadTitles(); toast('削除しました'); }
    });
    el.exportTextBtn.addEventListener('click', async () => {
      const a = await DB.listTitles(); downloadJSON(a, 'titles.json');
    });

    // URL追加（タイトル取得→保存→UI更新）
    el.addUrlBtn.addEventListener('click', async () => {
      const url = el.urlInput.value.trim();
      if (!url) return toast('URLを入力してください');
      try { new URL(url); } catch { return toast('URL形式が不正です'); }

      const fallbackTitle = hostnameOf(url) || url;
      const id = await DB.addUrl(url, fallbackTitle);
      el.urlInput.value = '';
      await loadUrls(true);
      toast('追加しました');

      // 非同期で本タイトル取得→DB更新→再描画
      try {
        const realTitle = await fetchPageTitle(url);
        if (realTitle && realTitle !== fallbackTitle) {
          await DB.updateUrl(id, { title: realTitle });
          await loadUrls(true);
        }
      } catch {/* 失敗は無視 */}
      if (state.urls.length === 1) updateViewer();
    });

    el.clearUrlBtn.addEventListener('click', async () => {
      if (confirm('URLを全削除しますか？')) { await DB.clearUrls(); await loadUrls(); toast('削除しました'); }
    });
    el.exportUrlBtn.addEventListener('click', async () => {
      const a = await DB.listUrls(); downloadJSON(a, 'urls.json');
    });

    el.prevBtn.addEventListener('click', goPrev);
    el.nextBtn.addEventListener('click', goNext);

    Promise.all([loadTitles(), loadUrls()]).catch(console.error);
  };

  const downloadJSON = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  };

  return { init };
})();
