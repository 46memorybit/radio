export const App = (() => {
  let DB;
  let state = { urls: [], currentIndex: 0, titles: [] };

  // DOM
  const qs = (s) => document.querySelector(s);
  let el = {};

  const toast = (msg) => {
    const t = el.toast;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1200);
  };

  const escapeHtml = (s='') =>
    s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---------- Renderers ---------- */
  const renderTitles = () => {
    const list = el.copyList;
    list.innerHTML = '';
    state.titles.forEach((it) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill';
      pill.title = 'タップでコピー';
      pill.dataset.id = it.id ?? '';
      pill.innerHTML = `<span>${escapeHtml(it.title || '(無題)')}</span><small>コピー</small>`;
      pill.addEventListener('click', async () => {
        const text = it.text || '';
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove();
        }
        toast('コピーしました');
      });
      // 長押し削除
      let timer = null;
      pill.addEventListener('mousedown', () => {
        timer = setTimeout(async () => {
          if (confirm('このタイトルを削除しますか？')) {
            await DB.deleteTitle(it.id);
            await loadTitles();
          }
        }, 700);
      });
      ['mouseup','mouseleave','touchend','touchcancel'].forEach(e =>
        pill.addEventListener(e, () => clearTimeout(timer)));

      list.appendChild(pill);
    });
    el.copyCount.textContent = `${state.titles.length} 件`;
  };

  const renderUrlList = () => {
    const list = el.urlList;
    list.innerHTML = '';
    state.urls.forEach((it) => {
      const item = document.createElement('div');
      item.className = 'url-item';
      item.draggable = true;
      item.dataset.id = it.id;

      const drag = document.createElement('span');
      drag.className = 'drag';
      drag.textContent = '↕';

      const text = document.createElement('div');
      text.className = 'url-text';
      text.textContent = it.url;

      const goBtn = document.createElement('button');
      goBtn.type = 'button';
      goBtn.className = 'btn';
      goBtn.textContent = '表示';
      goBtn.addEventListener('click', () => goToUrlId(it.id));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn del';
      del.textContent = '削除';
      del.addEventListener('click', async () => {
        await DB.deleteUrl(it.id);
        await loadUrls(true);
        toast('削除しました');
      });

      item.appendChild(drag);
      item.appendChild(text);
      item.appendChild(goBtn);
      item.appendChild(del);

      // D&D
      item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', String(it.id));
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));

      list.appendChild(item);
    });

    // 受け側（毎回重複バインド防止のため一度だけ付ける）
    if (!list._dndBound) {
      list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = list.querySelector('.dragging');
        const after = getDragAfterElement(list, e.clientY);
        if (!dragging) return;
        if (after == null) list.appendChild(dragging);
        else list.insertBefore(dragging, after);
      });

      list.addEventListener('drop', async () => {
        const newOrder = Array.from(list.children).map(li => li.dataset.id);
        await DB.saveOrder(newOrder);
        await loadUrls(true);
        toast('並び順を保存しました');
      });

      list._dndBound = true;
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

  const updateViewer = () => {
    const n = state.urls.length;
    if (!n) { el.viewer.src = 'about:blank'; return; }
    if (state.currentIndex < 0) state.currentIndex = 0;
    if (state.currentIndex >= n) state.currentIndex = n - 1;
    el.viewer.src = state.urls[state.currentIndex].url;
  };

  const goPrev = () => {
    if (!state.urls.length) return;
    state.currentIndex = (state.currentIndex - 1 + state.urls.length) % state.urls.length;
    updateViewer();
  };
  const goNext = () => {
    if (!state.urls.length) return;
    state.currentIndex = (state.currentIndex + 1) % state.urls.length;
    updateViewer();
  };
  const goToUrlId = (id) => {
    const idx = state.urls.findIndex(u => u.id === id);
    if (idx >= 0) { state.currentIndex = idx; updateViewer(); }
  };

  /* ---------- IO ---------- */
  const loadTitles = async () => {
    state.titles = await DB.listTitles();
    renderTitles();
  };
  const loadUrls = async (keepIndex=false) => {
    const curId = state.urls[state.currentIndex]?.id;
    state.urls = await DB.listUrls();
    renderUrlList();
    if (keepIndex && curId) {
      const idx = state.urls.findIndex(u => u.id === curId);
      state.currentIndex = idx >= 0 ? idx : 0;
    } else {
      state.currentIndex = 0;
    }
    updateViewer();
  };

  /* ---------- Init & Events ---------- */
  const init = ({ DB: db }) => {
    DB = db;
    el = {
      copyList: qs('#copyList'),
      copyCount: qs('#copyCount'),
      titleInput: qs('#titleInput'),
      textInput: qs('#textInput'),
      saveTextBtn: qs('#saveTextBtn'),
      exportTextBtn: qs('#exportTextBtn'),
      clearTextBtn: qs('#clearTextBtn'),
      urlInput: qs('#urlInput'),
      addUrlBtn: qs('#addUrlBtn'),
      exportUrlBtn: qs('#exportUrlBtn'),
      clearUrlBtn: qs('#clearUrlBtn'),
      urlList: qs('#urlList'),
      prevBtn: qs('#prevBtn'),
      nextBtn: qs('#nextBtn'),
      viewer: qs('#viewer'),
      toast: qs('#toast'),
    };

    // ---- テキスト保存（楽観更新） ----
    el.saveTextBtn.addEventListener('click', async () => {
      const title = el.titleInput.value.trim();
      const text  = el.textInput.value;
      if (!title) return toast('タイトルを入力してください');

      // 楽観的にstateへ追加→描画→DB保存
      const tempId = `temp-${Date.now()}`;
      state.titles.push({ id: tempId, title, text, created: Date.now() });
      renderTitles();

      el.titleInput.value = '';
      el.textInput.value = '';

      try {
        const id = await DB.addTitle(title, text);
        // temp置換のため再ロード（ID確定）
        await loadTitles();
        toast('保存しました');
      } catch (e) {
        // 失敗：巻き戻し
        state.titles = state.titles.filter(t => t.id !== tempId);
        renderTitles();
        toast('保存に失敗しました');
        console.error(e);
      }
    });

    el.clearTextBtn.addEventListener('click', async () => {
      if (confirm('テキストを全削除しますか？')) {
        await DB.clearTitles();
        await loadTitles();
        toast('削除しました');
      }
    });
    el.exportTextBtn.addEventListener('click', async () => {
      const titles = await DB.listTitles();
      downloadJSON(titles, 'titles.json');
    });

    // ---- URL追加（楽観更新） ----
    el.addUrlBtn.addEventListener('click', async () => {
      const url = el.urlInput.value.trim();
      if (!url) return toast('URLを入力してください');
      try { new URL(url); } catch { return toast('URL形式が不正です'); }

      const tempId = `temp-${Date.now()}`;
      const newItem = { id: tempId, url, order: state.urls.length, created: Date.now() };
      state.urls.push(newItem);
      renderUrlList();
      if (state.urls.length === 1) updateViewer();

      el.urlInput.value = '';

      try {
        await DB.addUrl(url);
        await loadUrls(true);
        toast('追加しました');
      } catch (e) {
        state.urls = state.urls.filter(u => u.id !== tempId);
        renderUrlList();
        toast('追加に失敗しました');
        console.error(e);
      }
    });

    el.clearUrlBtn.addEventListener('click', async () => {
      if (confirm('URLを全削除しますか？')) {
        await DB.clearUrls();
        await loadUrls();
        toast('削除しました');
      }
    });
    el.exportUrlBtn.addEventListener('click', async () => {
      const urls = await DB.listUrls();
      downloadJSON(urls, 'urls.json');
    });

    el.prevBtn.addEventListener('click', goPrev);
    el.nextBtn.addEventListener('click', goNext);

    // 初回ロード
    Promise.all([loadTitles(), loadUrls()]).catch(console.error);
  };

  const downloadJSON = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return { init };
})();
