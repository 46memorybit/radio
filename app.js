export const App = (() => {
  let DB;
  const qs = (s) => document.querySelector(s);
  let el = {};
  let state = { titles: [], urls: [], currentIndex: 0 };

  /* ---------- helpers ---------- */
  const toast = (msg) => {
    const t = el.toast; t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1200);
  };
  const escapeHtml = (s='') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
      // 長押し削除
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
    state.urls.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'url-item';
      row.draggable = true;
      row.dataset.id = it.id;

      const drag = document.createElement('span'); drag.className = 'drag'; drag.textContent = '↕';
      const text = document.createElement('div'); text.className = 'url-text'; text.textContent = it.url;

      const up = document.createElement('button'); up.type='button'; up.className='btn-ghost'; up.textContent='↑';
      up.addEventListener('click', async () => moveUrl(idx, -1));

      const down = document.createElement('button'); down.type='button'; down.className='btn-ghost'; down.textContent='↓';
      down.addEventListener('click', async () => moveUrl(idx, +1));

      const del = document.createElement('button'); del.type='button'; del.className='btn'; del.textContent='削除';
      del.addEventListener('click', async () => { await DB.deleteUrl(it.id); await resequence(); await loadUrls(true); toast('削除しました'); });

      row.append(drag, text, up, down, del);
      // D&D
      row.addEventListener('dragstart', (e) => { row.classList.add('dragging'); e.dataTransfer.setData('text/plain', String(it.id)); });
      row.addEventListener('dragend',   () => row.classList.remove('dragging'));
      list.appendChild(row);
    });

    if (!list._bound) {
      list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = list.querySelector('.dragging');
        const after = getDragAfterElement(list, e.clientY);
        if (dragging) {
          if (after == null) list.appendChild(dragging);
          else list.insertBefore(dragging, after);
        }
      });
      list.addEventListener('drop', async () => {
        const newOrder = Array.from(list.children).map(li => li.dataset.id);
        await DB.saveOrder(newOrder);
        await loadUrls(true);
        toast('並び順を保存しました');
      });
      list._bound = true;
    }
  };

  const getDragAfterElement = (container, y) => {
    const els = [...container.querySelectorAll('.url-item:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  };

  const moveUrl = async (index, delta) => {
    const n = state.urls.length; if (!n) return;
    const j = index + delta; if (j < 0 || j >= n) return;
    const ids = [...state.urls];
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await DB.saveOrder(ids.map(x => x.id));
    await loadUrls(true);
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
  const resequence = async () => { // 削除後などのorder穴埋め
    const ids = (await DB.listUrls()).sort((a,b)=>a.order-b.order).map(v=>v.id);
    await DB.saveOrder(ids);
  };

  /* ---------- init ---------- */
  const init = ({ DB: db }) => {
    DB = db;
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

    // 保存→即反映（ID確定後に再ロード）
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

    el.addUrlBtn.addEventListener('click', async () => {
      const url = el.urlInput.value.trim();
      if (!url) return toast('URLを入力してください');
      try { new URL(url); } catch { return toast('URL形式が不正です'); }
      await DB.addUrl(url);
      el.urlInput.value = '';
      await loadUrls(true); toast('追加しました');
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
