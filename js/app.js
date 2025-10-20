export const App = (() => {
  let DB;
  let state = {
    urls: [],
    currentIndex: 0,
    titles: []
  };

  // DOM
  let el = {};
  const qs = (s) => document.querySelector(s);

  const toast = (msg) => {
    const t = el.toast;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1300);
  };

  // ---- 初期描画 ----
  const renderTitles = () => {
    const list = el.copyList;
    list.innerHTML = '';
    state.titles.forEach((it) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill';
      pill.title = 'タップでコピー';
      pill.dataset.id = it.id;
      pill.innerHTML = `<span>${escapeHtml(it.title || '(無題)')}</span><small>コピー</small>`;
      pill.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(it.text || '');
          toast('コピーしました');
        } catch {
          // フォールバック
          const ta = document.createElement('textarea');
          ta.value = it.text || '';
          document.body.appendChild(ta);
          ta.select(); document.execCommand('copy');
          ta.remove();
          toast('コピーしました');
        }
      });
      // 長押しで削除（モバイル配慮）
      let pressTimer = null;
      pill.addEventListener('mousedown', () => {
        pressTimer = setTimeout(async () => {
          if (confirm('このタイトルを削除しますか？')) {
            await DB.deleteTitle(it.id);
            await loadTitles();
          }
        }, 700);
      });
      ['mouseup','mouseleave','touchend','touchcancel'].forEach(evt =>
        pill.addEventListener(evt, ()=> clearTimeout(pressTimer)));

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
      goBtn.className = 'btn';
      goBtn.textContent = '表示';
      goBtn.addEventListener('click', () => goToUrlId(it.id));

      const del = document.createElement('button');
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

    // 並べ替えの受け側
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = list.querySelector('.dragging');
      const after = getDragAfterElement(list, e.clientY);
      if (after == null) list.appendChild(dragging);
      else list.insertBefore(dragging, after);
    });

    list.addEventListener('drop', async () => {
      const newOrder = Array.from(list.children).map(li => li.dataset.id);
      await DB.saveOrder(newOrder);
      await loadUrls();
      toast('並び順を保存しました');
    });
  };

  const getDragAfterElement = (container, y) => {
    const els = [...container.querySelectorAll('.url-item:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  };

  const updateViewer = () => {
    const n = state.urls.length;
    if (!n) {
      el.viewer.src = 'about:blank';
      return;
    }
    if (state.currentIndex < 0) state.currentIndex = 0;
    if (state.currentIndex >= n) state.currentIndex = n - 1;
    const url = state.urls[state.currentIndex].url;
    el.viewer.src = url;
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

  // ---- IO ----
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

  // ---- Util ----
  const escapeHtml = (s='') => s.replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ---- 初期化 ----
  const init = ({ DB: db }) => {
    DB = db;

    // map DOM
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

    // events
    el.saveTextBtn.addEventListener('click', async () => {
      const title = el.titleInput.value.trim();
      const text  = el.textInput.value;
      if (!title) return toast('タイトルを入力してください');
      await DB.addTitle(title, text);
      el.titleInput.value = '';
      el.textInput.value = '';
      await loadTitles();
      toast('保存しました');
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

    el.addUrlBtn.addEventListener('click', async () => {
      const url = el.urlInput.value.trim();
      if (!url) return toast('URLを入力してください');
      try { new URL(url); } catch { return toast('URL形式が不正です'); }
      await DB.addUrl(url);
      el.urlInput.value = '';
      await loadUrls(true);
      toast('追加しました');
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
