// flashcards-app.js — robust init + cache-safe CSV loading
(() => {
  const FRONT = "Front";
  const BACK = "Back";
  const CHAPTER = "Chapter";

  const el = (id) => document.getElementById(id);

  // App state
  let DATA = [];
  let viewed = new Set();
  let pool = [];
  let filtered = [];
  let history = [];
  let histPtr = -1;
  let current = null;

  // DOM refs (bound at init)
  let chapterFilter, applyFilter, reshuffle, clearViewed, resetSession;
  let cardInner, frontText, backText;
  let metaPool, metaViewed, metaChapter, metaProgress;
  let prevBtn, nextBtn, flipBtn, skipBtn;
  let emptyState, card;

  function bindElements() {
    chapterFilter = el('chapterFilter');
    applyFilter   = el('applyFilter');
    reshuffle     = el('reshuffle');
    clearViewed   = el('clearViewed');
    resetSession  = el('resetSession');

    cardInner = el('cardInner');
    frontText = el('frontText');
    backText  = el('backText');

    metaPool     = el('metaPool');
    metaViewed   = el('metaViewed');
    metaChapter  = el('metaChapter');
    metaProgress = el('metaProgress');

    prevBtn = el('prevBtn');
    nextBtn = el('nextBtn');
    flipBtn = el('flipBtn');
    skipBtn = el('skipBtn');

    emptyState = el('emptyState');
    card = el('card');
  }

  // ---------- Helpers ----------
  const rngShuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  function populateChapters() {
    if (!chapterFilter) return;
    // Clear existing (keep the "All" option at index 0)
    Array.from(chapterFilter.querySelectorAll('option')).forEach((opt, idx) => { if (idx > 0) opt.remove(); });
    const chapters = Array.from(new Set(DATA.map(r => r[CHAPTER]))).sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
    for (const ch of chapters) {
      const opt = document.createElement('option');
      opt.value = String(ch);
      opt.textContent = `Chapter ${ch}`;
      chapterFilter.appendChild(opt);
    }
  }

  function rebuildFiltered() {
    const sel = chapterFilter ? chapterFilter.value : "__ALL__";
    filtered = DATA
      .map((r, i) => ({ ...r, __idx: i }))
      .filter(r => sel === "__ALL__" ? true : String(r[CHAPTER]) === sel);
    if (metaChapter) metaChapter.textContent = `Chapter: ${sel === "__ALL__" ? "All" : sel}`;
  }

  function rebuildPool(preserveHistoryPointer = false) {
    const viewedFilteredIdx = new Set(
      Array.from(viewed).map(globalIdx => {
        const pos = filtered.findIndex(f => f.__idx === globalIdx);
        return pos;
      }).filter(v => v !== -1)
    );
    pool = [];
    for (let i = 0; i < filtered.length; i++) {
      if (!viewedFilteredIdx.has(i)) pool.push(i);
    }
    rngShuffle(pool);
    updateMeta();
    updateEmptyState();
    if (!preserveHistoryPointer) {
      history = [];
      histPtr = -1;
      current = null;
    }
  }

  function updateMeta() {
    if (metaPool)    metaPool.textContent = `Pool: ${pool.length}`;
    if (metaViewed)  metaViewed.textContent = `Viewed: ${viewed.size}`;
    if (metaProgress) metaProgress.textContent = `Progress: ${history.length > 0 ? (histPtr + 1) : 0} / ${history.length}`;
  }

  function updateEmptyState() {
    const noCards = (pool.length === 0 && histPtr === -1);
    if (emptyState) emptyState.hidden = !noCards;
    if (card) card.style.display = noCards ? 'none' : 'block';
  }

  function showCard(filteredIdx, pushHistory = true) {
    current = filteredIdx;
    const rec = filtered[filteredIdx];
    if (frontText) frontText.textContent = rec[FRONT] ?? "";
    if (backText)  backText.textContent  = rec[BACK]  ?? "";
    if (cardInner) cardInner.classList.remove('flipped');

    if (pushHistory) {
      if (histPtr < history.length - 1) history = history.slice(0, histPtr + 1);
      history.push(filteredIdx);
      histPtr = history.length - 1;
    }
    updateMeta();
  }

  function takeNextFromPool() {
    if (pool.length === 0) { updateEmptyState(); return; }
    const nextIdx = pool.shift();
    const globalIdx = filtered[nextIdx].__idx;
    viewed.add(globalIdx);
    showCard(nextIdx, true);
    updateMeta();
    updateEmptyState();
  }

  function wireControls() {
    applyFilter && applyFilter.addEventListener('click', () => {
      rebuildFiltered();
      rebuildPool();
      takeNextFromPool();
    });

    reshuffle && reshuffle.addEventListener('click', () => {
      rngShuffle(pool);
      updateMeta();
    });

    clearViewed && clearViewed.addEventListener('click', () => {
      viewed.clear();
      rebuildPool(true);
      updateMeta();
    });

    resetSession && resetSession.addEventListener('click', () => {
      viewed.clear();
      history = [];
      histPtr = -1;
      rebuildFiltered();
      rebuildPool();
      takeNextFromPool();
    });

    flipBtn && flipBtn.addEventListener('click', () => { cardInner && cardInner.classList.toggle('flipped'); });
    cardInner && cardInner.addEventListener('click', () => { cardInner.classList.toggle('flipped'); });

    prevBtn && prevBtn.addEventListener('click', () => {
      if (histPtr > 0) {
        histPtr -= 1;
        const idx = history[histPtr];
        showCard(idx, false);
      }
      updateMeta();
    });

    nextBtn && nextBtn.addEventListener('click', () => {
      if (histPtr < history.length - 1) {
        histPtr += 1;
        showCard(history[histPtr], false);
      } else {
        takeNextFromPool();
      }
    });

    skipBtn && skipBtn.addEventListener('click', () => {
      takeNextFromPool();
    });

    // Optional keyboard support (desktop)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); cardInner && cardInner.classList.toggle('flipped'); }
      if (e.key === 'ArrowLeft')  { prevBtn && prevBtn.click(); }
      if (e.key === 'ArrowRight') { nextBtn && nextBtn.click(); }
    });
  }

  // Minimal CSV parser with quote support
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ""; }
        else if (c === '\n' || c === '\r') {
          row.push(field); field = "";
          if (row.length) rows.push(row);
          row = [];
          if (c === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        } else {
          field += c;
        }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // ---------- Public API ----------
  window.__FlashcardsApp__ = {
    initWithData(data) {
      bindElements();
      DATA = data;
      populateChapters();
      rebuildFiltered();
      rebuildPool();
      takeNextFromPool();
      wireControls();
    },

    async initFromCSV(url) {
      bindElements();
      const res = await fetch(url, { cache: 'no-store' }); // defeat HTTP cache
      if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
      const text = await res.text();
      const rows = parseCSV(text);
      const header = rows[0].map(s => s.trim());
      const iFront   = header.findIndex(h => h.toLowerCase() === 'front');
      const iBack    = header.findIndex(h => h.toLowerCase() === 'back');
      const iChapter = header.findIndex(h => h.toLowerCase() === 'chapter');
      if (iFront < 0 || iBack < 0 || iChapter < 0) {
        throw new Error('CSV must include Front, Back, Chapter columns');
      }
      DATA = rows.slice(1).map(r => ({
        Front:   r[iFront]   ?? '',
        Back:    r[iBack]    ?? '',
        Chapter: r[iChapter] ?? ''
      }));
      populateChapters();
      rebuildFiltered();
      rebuildPool();
      takeNextFromPool();
      wireControls();
    }
  };
})();
