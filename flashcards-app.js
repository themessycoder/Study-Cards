
// flashcards-app.js
(() => {
  const FRONT = "Front";
  const BACK = "Back";
  const CHAPTER = "Chapter";

  const el = (id) => document.getElementById(id);
  const chapterFilter = el('chapterFilter');
  const applyFilter = el('applyFilter');
  const reshuffle = el('reshuffle');
  const clearViewed = el('clearViewed');
  const resetSession = el('resetSession');

  const cardInner = el('cardInner');
  const frontText = el('frontText');
  const backText = el('backText');

  const metaPool = el('metaPool');
  const metaViewed = el('metaViewed');
  const metaChapter = el('metaChapter');
  const metaProgress = el('metaProgress');

  const prevBtn = el('prevBtn');
  const nextBtn = el('nextBtn');
  const flipBtn = el('flipBtn');
  const skipBtn = el('skipBtn');

  const emptyState = el('emptyState');
  const card = el('card');

  let DATA = [];
  let viewed = new Set();
  let pool = [];
  let filtered = [];
  let history = [];
  let histPtr = -1;
  let current = null;

  const rngShuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const rebuildFiltered = () => {
    const sel = chapterFilter.value;
    filtered = DATA
      .map((r, i) => ({ ...r, __idx: i }))
      .filter(r => sel === "__ALL__" ? true : String(r[CHAPTER]) === sel);
    metaChapter.textContent = `Chapter: ${sel === "__ALL__" ? "All" : sel}`;
  };

  const rebuildPool = (preserveHistoryPointer = false) => {
    const viewedFilteredIdx = new Set(
      Array.from(viewed).map(globalIdx => {
        const pos = filtered.findIndex(f => f.__idx === globalIdx);
        return pos;
      }).filter(v => v !== -1)
    );
    pool = [];
    for (let i = 0; i < filtered.length; i++) {
      if (!viewedFilteredIdx.has(i)) {
        pool.push(i);
      }
    }
    rngShuffle(pool);
    updateMeta();
    updateEmptyState();
    if (!preserveHistoryPointer) {
      history = [];
      histPtr = -1;
      current = null;
    }
  };

  const updateMeta = () => {
    metaPool.textContent = `Pool: ${pool.length}`;
    metaViewed.textContent = `Viewed: ${viewed.size}`;
    metaProgress.textContent = `Progress: ${history.length > 0 ? (histPtr + 1) : 0} / ${history.length}`;
  };

  const updateEmptyState = () => {
    const noCards = (pool.length === 0 && histPtr === -1);
    emptyState && (emptyState.hidden = !noCards);
    card && (card.style.display = noCards ? 'none' : 'block');
  };

  const showCard = (filteredIdx, pushHistory = true) => {
    current = filteredIdx;
    const rec = filtered[filteredIdx];
    frontText.textContent = rec[FRONT] ?? "";
    backText.textContent = rec[BACK] ?? "";
    cardInner.classList.remove('flipped');
    if (pushHistory) {
      if (histPtr < history.length - 1) history = history.slice(0, histPtr + 1);
      history.push(filteredIdx);
      histPtr = history.length - 1;
    }
    updateMeta();
  };

  const takeNextFromPool = () => {
    if (pool.length === 0) {
      updateEmptyState();
      return;
    }
    const nextIdx = pool.shift();
    const globalIdx = filtered[nextIdx].__idx;
    viewed.add(globalIdx);
    showCard(nextIdx, true);
    updateMeta();
    updateEmptyState();
  };

  const populateChapters = () => {
    Array.from(chapterFilter.querySelectorAll('option')).forEach((opt, idx) => { if (idx>0) opt.remove(); });
    const chapters = Array.from(new Set(DATA.map(r => r[CHAPTER]))).sort((a,b) => {
      const na = parseFloat(a); const nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
    for (const ch of chapters) {
      const opt = document.createElement('option');
      opt.value = String(ch);
      opt.textContent = `Chapter ${ch}`;
      chapterFilter.appendChild(opt);
    }
  };

  const wireControls = () => {
    applyFilter.addEventListener('click', () => {
      rebuildFiltered();
      rebuildPool();
      takeNextFromPool();
    });

    reshuffle.addEventListener('click', () => {
      rngShuffle(pool);
      updateMeta();
    });

    clearViewed.addEventListener('click', () => {
      viewed.clear();
      rebuildPool(true);
      updateMeta();
    });

    resetSession.addEventListener('click', () => {
      viewed.clear();
      history = [];
      histPtr = -1;
      rebuildFiltered();
      rebuildPool();
      takeNextFromPool();
    });

    flipBtn.addEventListener('click', () => cardInner.classList.toggle('flipped'));
    cardInner.addEventListener('click', () => cardInner.classList.toggle('flipped'));

    prevBtn.addEventListener('click', () => {
      if (histPtr > 0) {
        histPtr -= 1;
        const idx = history[histPtr];
        showCard(idx, false);
      }
      updateMeta();
    });

    nextBtn.addEventListener('click', () => {
      if (histPtr < history.length - 1) {
        histPtr += 1;
        showCard(history[histPtr], false);
      } else {
        takeNextFromPool();
      }
    });

    skipBtn.addEventListener('click', () => {
      takeNextFromPool();
    });

    // iPhone has no physical keyboard, but still support if available.
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); cardInner.classList.toggle('flipped'); }
      if (e.key === 'ArrowLeft') { prevBtn.click(); }
      if (e.key === 'ArrowRight') { nextBtn.click(); }
    });
  };

  window.__FlashcardsApp__ = {
    initWithData(data) {
      DATA = data;
      populateChapters();
      rebuildFiltered();
      rebuildPool();
      takeNextFromPool();
      wireControls();
    },
    async initFromCSV(url) {
      const text = await fetch(url).then(r => r.text());
      const rows = parseCSV(text);
      const header = rows[0].map(s => s.trim());
      const iFront = header.findIndex(h => h.toLowerCase() === 'front');
      const iBack = header.findIndex(h => h.toLowerCase() === 'back');
      const iChapter = header.findIndex(h => h.toLowerCase() === 'chapter');
      if (iFront < 0 || iBack < 0 || iChapter < 0) throw new Error('CSV must include Front, Back, Chapter columns');
      DATA = rows.slice(1).map(r => ({
        Front: r[iFront] ?? '',
        Back: r[iBack] ?? '',
        Chapter: r[iChapter] ?? ''
      }));
      this.initWithData(DATA);
    }
  };

  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < text.length && text[i+1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ""; }
        else if (c === '\n' || c === '\r') {
          row.push(field); field = "";
          if (row.length) rows.push(row);
          row = [];
          if (c === '\r' && i + 1 < text.length && text[i+1] === '\n') i++;
        } else { field += c; }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
})();
