/**
 * script.js — Cosmic Planner / Task List App
 *
 * Features:
 *  1. Starfield canvas animation (twinkling stars)
 *  2. Live date & time display in header
 *  3. Task CRUD + toggle + filter (All | Active | Completed)
 *  4. Agenda with date picker (per-date storage)
 *  5. Daily quote — write, save, randomise from a built-in pool
 *  6. Motivator photo frame — upload image, name, note; persist in localStorage
 *
 * Architecture: pure IIFE module, Vanilla JS, no external libraries.
 * Storage: localStorage keys are namespaced with "cosmicPlanner_".
 */

(function () {
  "use strict";

  /* ============================================================
     SECTION A — STARFIELD CANVAS
     Draws and animates twinkling stars on a <canvas> element.
     ============================================================ */

  (function initStarfield() {
    const canvas = document.getElementById("starCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    /** @type {{ x:number, y:number, r:number, alpha:number, speed:number, twinkleDir:number }[]} */
    let stars = [];
    const STAR_COUNT = 160;

    /** Resize canvas to match viewport. */
    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    /** Seed the stars array with random positions. */
    function seedStars() {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x:          Math.random() * canvas.width,
          y:          Math.random() * canvas.height,
          r:          Math.random() * 1.4 + 0.3,
          alpha:      Math.random(),
          speed:      Math.random() * 0.008 + 0.003,
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
        });
      }
    }

    /** Draw one animation frame. */
    let animPaused = false;
    function draw() {
      if (!animPaused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach((s) => {
          // Gentle twinkle — oscillate alpha
          s.alpha += s.speed * s.twinkleDir;
          if (s.alpha > 1)   { s.alpha = 1;   s.twinkleDir = -1; }
          if (s.alpha < 0.1) { s.alpha = 0.1; s.twinkleDir =  1; }

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(109, 40, 217, ${s.alpha * 0.55})`;
          ctx.fill();
        });
      }
      requestAnimationFrame(draw);
    }

    resize();
    seedStars();
    draw();
    window.addEventListener("resize", () => { resize(); seedStars(); });
    // Pause animation when tab is hidden to save CPU/battery
    document.addEventListener("visibilitychange", () => {
      animPaused = document.hidden;
    });
  })();

  /* ============================================================
     SECTION B — LIVE DATE & TIME
     ============================================================ */

  const headerDate = document.getElementById("headerDate");
  const headerTime = document.getElementById("headerTime");

  /** Months in Indonesian (for warm personalised feel) */
  const MONTHS_ID = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];
  const DAYS_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

  /** Update header clock every second. */
  function tickClock() {
    const now  = new Date();
    const day  = DAYS_ID[now.getDay()];
    const date = now.getDate();
    const mon  = MONTHS_ID[now.getMonth()];
    const yr   = now.getFullYear();
    const hh   = String(now.getHours()).padStart(2, "0");
    const mm   = String(now.getMinutes()).padStart(2, "0");
    const ss   = String(now.getSeconds()).padStart(2, "0");

    if (headerDate) headerDate.textContent = `${day}, ${date} ${mon} ${yr}`;
    if (headerTime) headerTime.textContent = `${hh}:${mm}:${ss}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ============================================================
     SECTION B2 — THEME (DARK / LIGHT MODE)
     Auto-detects system preference; manual override stored in localStorage.
     Toggle button cycles: system → light → dark → system
     ============================================================ */

  (function initTheme() {
    const root    = document.documentElement;
    const btn     = document.getElementById("themeToggleBtn");
    const ICONS   = { light: "☀️", dark: "🌙", system: "✦" };

    /** Read stored preference — "light" | "dark" | "system" | null */
    function getStored() {
      try { return localStorage.getItem("cosmicPlanner_theme"); } catch { return null; }
    }

    /** Apply theme to <html data-theme="..."> */
    function applyTheme(pref) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = pref === "dark" || (pref !== "light" && prefersDark);
      root.dataset.theme = isDark ? "dark" : "light";
      if (btn) btn.textContent = ICONS[pref] || ICONS.system;
    }

    /** Save & apply a preference */
    function setTheme(pref) {
      try { localStorage.setItem("cosmicPlanner_theme", pref); } catch {}
      applyTheme(pref);
    }

    // Cycle on button click: light → dark → system
    if (btn) {
      btn.addEventListener("click", () => {
        const cur = getStored() || "system";
        const next = cur === "light" ? "dark" : cur === "dark" ? "system" : "light";
        setTheme(next);
      });
    }

    // React to OS preference changes (if user is on "system" mode)
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!getStored() || getStored() === "system") applyTheme("system");
    });

    // Initial apply
    applyTheme(getStored() || "system");
  })();

  /* ============================================================
     SECTION C — STORAGE HELPERS
     ============================================================ */

  const NS = "cosmicPlanner_"; // namespace prefix for all keys

  /** Read a value from localStorage (JSON). Returns fallback on failure. */
  function lsGet(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(NS + key)) ?? fallback; }
    catch { return fallback; }
  }

  /** Write a value to localStorage (JSON). Shows a toast if storage is full. */
  function lsSet(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
        const toast = document.getElementById("storageToast");
        if (toast) {
          toast.classList.remove("hidden");
          setTimeout(() => toast.classList.add("hidden"), 4000);
        }
      }
    }
  }

  /* ============================================================
     SECTION D — MOTIVATOR PHOTO FRAME
     Supports: image upload (converted to data-URL), name, note.
     All persisted in localStorage.
     ============================================================ */

  const photoInput      = document.getElementById("photoInput");
  const motivatorImg    = document.getElementById("motivatorImg");
  const photoPlaceholder= document.getElementById("photoPlaceholder");
  const removePhotoBtn  = document.getElementById("removePhotoBtn");
  const photoError      = document.getElementById("photoError");
  const motivatorName   = document.getElementById("motivatorName");
  const motivatorNote   = document.getElementById("motivatorNote");
  const saveMotivatorBtn= document.getElementById("saveMotivatorBtn");

  /** Apply stored motivator data to the UI. */
  function loadMotivator() {
    const data = lsGet("motivator", {});
    if (data.photo) {
      showPhoto(data.photo);
    }
    if (motivatorName) motivatorName.value = data.name || "";
    if (motivatorNote) motivatorNote.value = data.note || "";
  }

  /** Show an image in the frame, hide placeholder. */
  function showPhoto(src) {
    if (motivatorImg) {
      motivatorImg.src = src;
      motivatorImg.classList.remove("hidden");
      // Update alt text dynamically to the saved motivator name
      const saved = lsGet("motivator", {});
      motivatorImg.alt = saved.name ? saved.name : "Motivator";
    }
    if (photoPlaceholder) photoPlaceholder.classList.add("hidden");
    if (removePhotoBtn) removePhotoBtn.classList.remove("hidden");
  }

  /** Reset frame to placeholder state. */
  function clearPhoto() {
    if (motivatorImg) { motivatorImg.src = ""; motivatorImg.classList.add("hidden"); }
    if (photoPlaceholder) photoPlaceholder.classList.remove("hidden");
    if (removePhotoBtn) removePhotoBtn.classList.add("hidden");
  }

  // When user picks a file, convert to data-URL and display
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file = photoInput.files[0];
      if (!file) return;
      // Validate file size — reject files larger than 2 MB
      if (file.size > 2 * 1024 * 1024) {
        if (photoError) photoError.classList.remove("hidden");
        photoInput.value = "";
        return;
      }
      if (photoError) photoError.classList.add("hidden");
      const reader = new FileReader();
      reader.onload = (e) => {
        showPhoto(e.target.result);
        // Save photo immediately so it persists
        const data = lsGet("motivator", {});
        data.photo = e.target.result;
        lsSet("motivator", data);
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be re-selected
      photoInput.value = "";
    });
  }

  // Save name + note
  if (saveMotivatorBtn) {
    saveMotivatorBtn.addEventListener("click", () => {
      const data = lsGet("motivator", {});
      data.name  = motivatorName ? motivatorName.value.trim() : "";
      data.note  = motivatorNote ? motivatorNote.value.trim() : "";
      lsSet("motivator", data);
      // Update alt text if photo is already shown
      if (motivatorImg && !motivatorImg.classList.contains("hidden")) {
        motivatorImg.alt = data.name || "Motivator";
      }
      // Brief visual feedback
      saveMotivatorBtn.textContent = "Tersimpan ✓";
      setTimeout(() => { saveMotivatorBtn.textContent = "Save ✦"; }, 1500);
    });
  }

  // Remove photo
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener("click", () => {
      clearPhoto();
      const data = lsGet("motivator", {});
      delete data.photo;
      lsSet("motivator", data);
    });
  }

  loadMotivator();

  /* ============================================================
     SECTION E — DAILY QUOTE
     Built-in pool of inspirational quotes.
     User can also write & save their own.
     ============================================================ */

  const quoteText          = document.getElementById("quoteText");
  const quoteAuthor        = document.getElementById("quoteAuthor");
  const quoteCounter       = document.getElementById("quoteCounter");
  const quoteDisplay       = document.getElementById("quoteDisplay");
  const quoteList          = document.getElementById("quoteList");
  const quoteInput         = document.getElementById("quoteInput");
  const quoteAuthorInput   = document.getElementById("quoteAuthorInput");
  const saveQuoteBtn       = document.getElementById("saveQuoteBtn");
  const randomQuoteBtn     = document.getElementById("randomQuoteBtn");
  const quotePrevBtn       = document.getElementById("quotePrevBtn");
  const quoteNextBtn       = document.getElementById("quoteNextBtn");
  const toggleSavedQuotes  = document.getElementById("toggleSavedQuotes");
  const savedQuoteCount    = document.getElementById("savedQuoteCount");
  const savedQuoteChevron  = document.getElementById("savedQuoteChevron");

  /** Built-in pool quotes. */
  const BUILTIN_QUOTES = [
    { text: "The cosmos is within us. We are made of star-stuff.", author: "Carl Sagan" },
    { text: "Look up at the stars and not down at your feet.", author: "Stephen Hawking" },
    { text: "We are all star-stuff harvested from long dead stars.", author: "Carl Sagan" },
    { text: "Shoot for the moon. Even if you miss, you'll land among the stars.", author: "Les Brown" },
    { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
    { text: "Per aspera ad astra — Through hardship to the stars.", author: "Latin proverb" },
    { text: "Kamu cukup. Kamu berharga. Teruslah bersinar.", author: "✦" },
    { text: "Setiap hari adalah kesempatan baru untuk bersinar seperti bintang.", author: "✦" },
    { text: "Di balik kegelapan malam, selalu ada bintang yang menunggumu.", author: "✦" },
    { text: "Bermimpilah setinggi bintang, lalu ciptakan jalanmu sendiri.", author: "✦" },
    { text: "Be the energy you want to attract.", author: "Unknown" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  ];

  /** Current index in the combined pool. */
  let quoteIndex = 0;
  /** Auto-rotate interval handle. */
  let quoteTimer = null;
  const ROTATE_MS = 8000; // 8 s per slide

  /** Load saved quotes array from localStorage. */
  function loadQuotes() { return lsGet("quotes", []); }

  /** Save quotes array to localStorage. */
  function saveQuotes(arr) { lsSet("quotes", arr); }

  /**
   * Build combined pool: saved quotes first, then built-ins.
   * @returns {{ text:string, author:string, saved?:boolean, id?:string }[]}
   */
  function buildPool() {
    const saved = loadQuotes().map((q) => ({ ...q, saved: true }));
    return [...saved, ...BUILTIN_QUOTES];
  }

  /** Display the quote at `quoteIndex` in the single display block. */
  function showQuoteAt(idx) {
    const pool = buildPool();
    if (!pool.length) return;
    quoteIndex = ((idx % pool.length) + pool.length) % pool.length; // wrap
    const q = pool[quoteIndex];

    if (quoteDisplay) {
      quoteDisplay.classList.remove("quote-fadeIn");
      void quoteDisplay.offsetWidth;
      quoteDisplay.classList.add("quote-fadeIn");
    }
    if (quoteText)    quoteText.textContent   = `"${q.text}"`;
    if (quoteAuthor)  quoteAuthor.textContent = `— ${q.author}`;
    if (quoteCounter) quoteCounter.textContent = `${quoteIndex + 1} / ${pool.length}`;
  }

  /** Advance to next quote and restart the auto-rotate timer. */
  function nextQuote() {
    showQuoteAt(quoteIndex + 1);
    resetTimer();
  }

  /** Go to previous quote and restart the auto-rotate timer. */
  function prevQuote() {
    showQuoteAt(quoteIndex - 1);
    resetTimer();
  }

  /** Jump to a random quote (different from the current one). */
  function randomQuote() {
    const pool = buildPool();
    if (pool.length <= 1) { showQuoteAt(0); resetTimer(); return; }
    let next;
    do { next = Math.floor(Math.random() * pool.length); } while (next === quoteIndex);
    showQuoteAt(next);
    resetTimer();
  }

  /** Start / restart the auto-rotate interval. */
  function resetTimer() {
    if (quoteTimer) clearInterval(quoteTimer);
    quoteTimer = setInterval(() => showQuoteAt(quoteIndex + 1), ROTATE_MS);
  }

  /** Re-render the collapsible saved quotes list panel. */
  function renderSavedList() {
    if (!quoteList) return;
    const quotes = loadQuotes();
    quoteList.innerHTML = "";
    quotes.forEach((q) => quoteList.appendChild(buildQuoteItem(q)));

    // Show/hide toggle button
    if (toggleSavedQuotes) {
      toggleSavedQuotes.classList.toggle("hidden", quotes.length === 0);
      if (savedQuoteCount) {
        savedQuoteCount.textContent = `Kata-kataku (${quotes.length})`;
      }
    }
    // If list is open, keep it rendered; if no items left, close it
    if (quotes.length === 0 && quoteList) {
      quoteList.classList.add("hidden");
      if (savedQuoteChevron) savedQuoteChevron.style.transform = "";
    }
  }

  /**
   * Build one saved-quote row for the list panel.
   * @param {{ id:string, text:string, author:string }} q
   */
  function buildQuoteItem(q) {
    const wrap = document.createElement("div");
    wrap.className = "quote-display quote-item";
    wrap.dataset.id = q.id;

    const p = document.createElement("p");
    p.className = "quote-text italic";
    p.textContent = `"${q.text}"`;

    const byline = document.createElement("div");
    byline.className = "quote-byline";

    const auth = document.createElement("p");
    auth.className = "quote-author";
    auth.textContent = `— ${q.author}`;

    const del = document.createElement("button");
    del.className = "quote-delete-btn";
    del.setAttribute("aria-label", "Hapus kata-kata ini");
    del.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
    del.addEventListener("click", () => deleteQuote(q.id));

    byline.appendChild(auth);
    byline.appendChild(del);
    wrap.appendChild(p);
    wrap.appendChild(byline);
    return wrap;
  }

  /** Delete a saved quote, refresh display and list. */
  function deleteQuote(id) {
    if (!confirm("Hapus kata-kata ini?")) return;
    const quotes = loadQuotes().filter((q) => q.id !== id);
    saveQuotes(quotes);
    // Keep index valid after deletion
    const pool = buildPool(); // pool after deletion
    if (quoteIndex >= pool.length) quoteIndex = Math.max(0, pool.length - 1);
    showQuoteAt(quoteIndex);
    renderSavedList();
  }

  /** Collapsible toggle */
  if (toggleSavedQuotes) {
    toggleSavedQuotes.addEventListener("click", () => {
      if (!quoteList) return;
      const isHidden = quoteList.classList.toggle("hidden");
      if (savedQuoteChevron) {
        savedQuoteChevron.style.transform = isHidden ? "" : "rotate(180deg)";
      }
    });
  }

  /** Initial load — migrate old single-quote storage, then start slideshow. */
  function loadQuote() {
    const old = lsGet("quote", null);
    if (old && old.text) {
      const existing = loadQuotes();
      existing.unshift({ id: `q_${Date.now()}`, text: old.text, author: old.author || "✦" });
      saveQuotes(existing);
      localStorage.removeItem(NS + "quote");
    }
    renderSavedList();
    showQuoteAt(0);
    resetTimer();
  }

  if (saveQuoteBtn) {
    saveQuoteBtn.addEventListener("click", () => {
      const text   = quoteInput ? quoteInput.value.trim() : "";
      const author = quoteAuthorInput ? quoteAuthorInput.value.trim() : "✦";
      if (!text) return;
      const quotes = loadQuotes();
      quotes.unshift({
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
        text,
        author: author || "✦",
      });
      saveQuotes(quotes);
      // Jump to the newly saved quote (index 0 in pool after rebuild)
      renderSavedList();
      showQuoteAt(0);
      resetTimer();
      if (quoteInput)       quoteInput.value = "";
      if (quoteAuthorInput) quoteAuthorInput.value = "";
      saveQuoteBtn.textContent = "Tersimpan ✓";
      setTimeout(() => { saveQuoteBtn.textContent = "Simpan ✦"; }, 1500);
    });
  }

  if (randomQuoteBtn)  randomQuoteBtn.addEventListener("click", randomQuote);
  if (quoteNextBtn)    quoteNextBtn.addEventListener("click", nextQuote);
  if (quotePrevBtn)    quotePrevBtn.addEventListener("click", prevQuote);

  loadQuote();

  /* ============================================================
     SECTION F — AGENDA (per-date task list)
     Stored as an object keyed by ISO date string (YYYY-MM-DD).
     Each date holds an array of { id, text, done, createdAt }.
     ============================================================ */

  const agendaDatePicker  = document.getElementById("agendaDatePicker");
  const selectedDateLabel = document.getElementById("selectedDateLabel");
  const agendaForm        = document.getElementById("agendaForm");
  const agendaInput       = document.getElementById("agendaInput");
  const agendaError       = document.getElementById("agendaError");
  const agendaList        = document.getElementById("agendaList");
  const agendaEmpty       = document.getElementById("agendaEmpty");

  /** Currently selected ISO date string. */
  let currentAgendaDate = todayISO();

  /** Return today's date as YYYY-MM-DD. */
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  /** Format an ISO date string to a human-readable Indonesian label. */
  function formatDateLabel(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return `${DAYS_ID[date.getDay()]}, ${d} ${MONTHS_ID[m-1]} ${y}`;
  }

  /** Load agenda data map from localStorage. */
  function loadAgendaMap() {
    return lsGet("agendaMap", {});
  }

  /** Get items for a specific date. */
  function getAgendaForDate(iso) {
    return loadAgendaMap()[iso] || [];
  }

  /** Save items for a specific date. */
  function saveAgendaForDate(iso, items) {
    const map = loadAgendaMap();
    map[iso] = items;
    lsSet("agendaMap", map);
  }

  /** Re-render the agenda list for the current date. */
  function renderAgenda() {
    if (!agendaList) return;
    const items = getAgendaForDate(currentAgendaDate);
    agendaList.innerHTML = "";

    if (selectedDateLabel) {
      selectedDateLabel.textContent = `📅 ${formatDateLabel(currentAgendaDate)}`;
    }

    // Progress indicator
    const agendaProgress = document.getElementById("agendaProgress");
    if (agendaProgress) {
      if (items.length > 0) {
        const doneCount = items.filter((i) => i.done).length;
        agendaProgress.textContent = `${doneCount} dari ${items.length} selesai`;
        agendaProgress.classList.remove("hidden");
      } else {
        agendaProgress.classList.add("hidden");
      }
    }

    if (items.length === 0) {
      if (agendaEmpty) agendaEmpty.classList.remove("hidden");
      return;
    }
    if (agendaEmpty) agendaEmpty.classList.add("hidden");

    items.forEach((item) => {
      agendaList.appendChild(buildAgendaItem(item));
    });
  }

  /**
   * Build a single agenda <li>.
   * @param {{ id:string, text:string, done:boolean, createdAt:number }} item
   */
  function buildAgendaItem(item) {
    const li = document.createElement("li");
    li.className = `agenda-item${item.done ? " done" : ""}`;
    li.dataset.id = item.id;

    // Circle checkbox
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "agenda-checkbox";
    cb.checked = item.done;
    cb.setAttribute("aria-label", `Toggle "${item.text}"`);
    cb.addEventListener("change", () => toggleAgendaItem(item.id));

    // Text
    const span = document.createElement("span");
    span.className = "agenda-text";
    span.textContent = item.text;

    // Time stamp
    const time = document.createElement("span");
    time.className = "agenda-time";
    const d = new Date(item.createdAt);
    time.textContent = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "btn-icon edit agenda-edit-btn";
    editBtn.setAttribute("aria-label", `Edit "${item.text}"`);
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`;
    editBtn.addEventListener("click", () => startAgendaEdit(item.id, span, li));

    // Delete
    const del = document.createElement("button");
    del.className = "btn-icon delete";
    del.setAttribute("aria-label", `Hapus "${item.text}"`);
    del.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
    </svg>`;
    del.addEventListener("click", () => deleteAgendaItem(item.id));

    li.appendChild(cb);
    li.appendChild(span);
    li.appendChild(time);
    li.appendChild(editBtn);
    li.appendChild(del);
    return li;
  }

  /**
   * Turn an agenda item's text span into an inline editable input.
   * @param {string} id - agenda item id
   * @param {HTMLElement} span - the .agenda-text element
   * @param {HTMLElement} li - the parent li
   */
  function startAgendaEdit(id, span, li) {
    if (li.querySelector(".agenda-inline-input")) return; // already editing
    const currentText = span.textContent;
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.maxLength = 120;
    input.className = "agenda-inline-input";
    span.replaceWith(input);
    input.focus();
    input.select();

    function commitEdit() {
      const newText = input.value.trim();
      if (newText && newText !== currentText) {
        const items = getAgendaForDate(currentAgendaDate);
        const item  = items.find((i) => i.id === id);
        if (item) { item.text = newText; saveAgendaForDate(currentAgendaDate, items); }
      }
      renderAgenda();
    }

    input.addEventListener("blur", commitEdit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = currentText; input.blur(); }
    });
  }

  /** Add a new agenda item to the current date. */
  function addAgendaItem(text) {
    const items = getAgendaForDate(currentAgendaDate);
    items.push({
      id: `ag_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      text: text.trim(),
      done: false,
      createdAt: Date.now(),
    });
    saveAgendaForDate(currentAgendaDate, items);
    renderAgenda();
  }

  /** Toggle done state of an agenda item. */
  function toggleAgendaItem(id) {
    const items = getAgendaForDate(currentAgendaDate);
    const item  = items.find((i) => i.id === id);
    if (item) {
      item.done = !item.done;
      saveAgendaForDate(currentAgendaDate, items);
      renderAgenda();
    }
  }

  /** Delete an agenda item. */
  function deleteAgendaItem(id) {
    if (!confirm("Hapus agenda ini?")) return;
    const items = getAgendaForDate(currentAgendaDate).filter((i) => i.id !== id);
    saveAgendaForDate(currentAgendaDate, items);
    renderAgenda();
  }

  // Set date picker default to today
  if (agendaDatePicker) {
    agendaDatePicker.value = currentAgendaDate;
    agendaDatePicker.addEventListener("change", () => {
      currentAgendaDate = agendaDatePicker.value || todayISO();
      if (selectedDateLabel) {
        selectedDateLabel.textContent = `📅 ${formatDateLabel(currentAgendaDate)}`;
      }
      renderAgenda();
    });
  }

  // Agenda form submit
  if (agendaForm) {
    agendaForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = agendaInput ? agendaInput.value.trim() : "";
      if (!text) {
        if (agendaError) agendaError.classList.remove("hidden");
        if (agendaInput) agendaInput.focus();
        return;
      }
      if (agendaError) agendaError.classList.add("hidden");
      addAgendaItem(text);
      if (agendaInput) { agendaInput.value = ""; agendaInput.focus(); }
    });
  }
  if (agendaInput) {
    agendaInput.addEventListener("input", () => {
      if (agendaInput.value.trim() && agendaError) agendaError.classList.add("hidden");
    });
  }

  /**
   * Remove all agendaMap entries whose date is more than 90 days in the past.
   * Prevents the stored map from growing indefinitely.
   */
  function pruneAgendaMap() {
    const map = loadAgendaMap();
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let pruned = false;
    Object.keys(map).forEach((iso) => {
      if (new Date(iso).getTime() < cutoff) {
        delete map[iso];
        pruned = true;
      }
    });
    if (pruned) lsSet("agendaMap", map);
  }

  // Init agenda
  if (selectedDateLabel) {
    selectedDateLabel.textContent = `📅 ${formatDateLabel(currentAgendaDate)}`;
  }
  renderAgenda();
  pruneAgendaMap();

  /* ============================================================
     SECTION G — TASK CRUD + FILTER
     ============================================================ */

  /**
   * @typedef {{ id: string, text: string, completed: boolean, createdAt: number }} Task
   */

  /** @type {Task[]} */
  let tasks = [];

  /** Current filter: 'all' | 'active' | 'completed' */
  let currentFilter = "all";

  /** ID of the task currently being edited (null = modal closed) */
  let editingTaskId = null;

  // ── DOM refs ──
  const taskForm          = document.getElementById("taskForm");
  const taskInput         = document.getElementById("taskInput");
  const inputError        = document.getElementById("inputError");
  const taskList          = document.getElementById("taskList");
  const emptyState        = document.getElementById("emptyState");
  const emptyTitle        = document.getElementById("emptyTitle");
  const emptySubtitle     = document.getElementById("emptySubtitle");
  const clearCompletedBtn = document.getElementById("clearCompletedBtn");
  const statAll           = document.getElementById("statAll");
  const statActive        = document.getElementById("statActive");
  const statCompleted     = document.getElementById("statCompleted");
  const filterButtons     = document.querySelectorAll(".filter-btn");
  const editModal         = document.getElementById("editModal");
  const modalOverlay      = document.getElementById("modalOverlay");
  const editInput         = document.getElementById("editInput");
  const editError         = document.getElementById("editError");
  const saveEditBtn       = document.getElementById("saveEditBtn");
  const cancelEditBtn     = document.getElementById("cancelEditBtn");

  // ── Persistence ──
  function loadTasks()  { return lsGet("tasks", []); }
  function saveTasks()  { lsSet("tasks", tasks); }

  // ── Task factory ──
  function createTask(text) {
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
    };
  }

  // ── Computed helpers ──
  const getActiveTasks    = () => tasks.filter((t) => !t.completed);
  const getCompletedTasks = () => tasks.filter((t) => t.completed);
  function getFilteredTasks() {
    if (currentFilter === "active")    return getActiveTasks();
    if (currentFilter === "completed") return getCompletedTasks();
    return tasks;
  }

  // ── Full render ──
  function render() {
    renderStats();
    renderList();
    renderEmptyState();
    renderClearBtn();
  }

  function renderStats() {
    if (statAll)       statAll.textContent       = tasks.length;
    if (statActive)    statActive.textContent    = getActiveTasks().length;
    if (statCompleted) statCompleted.textContent = getCompletedTasks().length;
  }

  function renderList() {
    if (!taskList) return;
    taskList.innerHTML = "";
    getFilteredTasks().forEach((t) => taskList.appendChild(buildTaskItem(t)));
  }

  /**
   * Build a single task <li>.
   * @param {Task} task
   * @returns {HTMLLIElement}
   */
  function buildTaskItem(task) {
    const li = document.createElement("li");
    li.className = `task-item${task.completed ? " completed" : ""}`;
    li.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark "${task.text}" as ${task.completed ? "active" : "completed"}`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = task.text;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-icon edit";
    editBtn.setAttribute("aria-label", `Edit "${task.text}"`);
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
           m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
    </svg>`;
    editBtn.addEventListener("click", () => openEditModal(task.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-icon delete";
    deleteBtn.setAttribute("aria-label", `Delete "${task.text}"`);
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
           m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>`;
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(actions);
    return li;
  }

  function renderEmptyState() {
    if (!emptyState) return;
    const isEmpty = getFilteredTasks().length === 0;
    if (isEmpty) {
      emptyState.classList.remove("hidden");
      emptyState.classList.add("flex-show");
      if (tasks.length === 0) {
        if (emptyTitle)    emptyTitle.textContent    = "Belum ada task";
        if (emptySubtitle) emptySubtitle.textContent = "Tambahkan task pertamamu di atas ✨";
      } else if (currentFilter === "active") {
        if (emptyTitle)    emptyTitle.textContent    = "Tidak ada task aktif";
        if (emptySubtitle) emptySubtitle.textContent = "Semua task sudah selesai! Luar biasa 🌙";
      } else if (currentFilter === "completed") {
        if (emptyTitle)    emptyTitle.textContent    = "Belum ada task selesai";
        if (emptySubtitle) emptySubtitle.textContent = "Mulai centang taskmu untuk melihatnya di sini ✦";
      }
    } else {
      emptyState.classList.add("hidden");
      emptyState.classList.remove("flex-show");
    }
  }

  function renderClearBtn() {
    if (!clearCompletedBtn) return;
    clearCompletedBtn.classList.toggle("hidden", getCompletedTasks().length === 0);
  }

  // ── CRUD operations ──
  function addTask(text)       { tasks.unshift(createTask(text)); saveTasks(); render(); }
  function toggleTask(id)      { const t = tasks.find((t) => t.id === id); if (t) { t.completed = !t.completed; saveTasks(); render(); } }
  function updateTask(id, txt) { const t = tasks.find((t) => t.id === id); if (t) { t.text = txt.trim(); saveTasks(); render(); } }
  function deleteTask(id)      {
    if (!confirm("Hapus task ini?")) return;
    tasks = tasks.filter((t) => t.id !== id); saveTasks(); render();
  }
  function clearCompleted()    {
    if (!confirm("Hapus semua task yang sudah selesai?")) return;
    tasks = tasks.filter((t) => !t.completed); saveTasks(); render();
  }

  // ── Filter ──
  function setFilter(filter) {
    currentFilter = filter;
    filterButtons.forEach((btn) => {
      const active = btn.dataset.filter === filter;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.classList.toggle("active-filter", active);
    });
    render();
  }

  // ── Edit modal ──
  function openEditModal(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    editingTaskId = id;
    if (editInput)  editInput.value = task.text;
    if (editError)  editError.classList.add("hidden");
    if (editModal) {
      editModal.classList.remove("hidden");
      editModal.classList.add("flex");
    }
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => { if (editInput) { editInput.focus(); editInput.select(); } });
  }

  function closeEditModal() {
    editingTaskId = null;
    if (editModal) { editModal.classList.add("hidden"); editModal.classList.remove("flex"); }
    document.body.style.overflow = "";
  }

  function saveEdit() {
    const newText = editInput ? editInput.value.trim() : "";
    if (!newText) {
      if (editError) editError.classList.remove("hidden");
      if (editInput) editInput.focus();
      return;
    }
    if (editError) editError.classList.add("hidden");
    updateTask(editingTaskId, newText);
    closeEditModal();
  }

  // ── Event listeners: tasks ──
  if (taskForm) {
    taskForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = taskInput ? taskInput.value.trim() : "";
      if (!text) {
        if (inputError) inputError.classList.remove("hidden");
        if (taskInput)  taskInput.focus();
        return;
      }
      if (inputError) inputError.classList.add("hidden");
      addTask(text);
      if (taskInput) { taskInput.value = ""; taskInput.focus(); }
    });
  }
  if (taskInput) {
    taskInput.addEventListener("input", () => {
      if (taskInput.value.trim() && inputError) inputError.classList.add("hidden");
    });
  }
  filterButtons.forEach((btn) => btn.addEventListener("click", () => setFilter(btn.dataset.filter)));
  if (clearCompletedBtn) clearCompletedBtn.addEventListener("click", clearCompleted);
  if (saveEditBtn)   saveEditBtn.addEventListener("click", saveEdit);
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditModal);
  if (modalOverlay)  modalOverlay.addEventListener("click", closeEditModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editModal && !editModal.classList.contains("hidden")) closeEditModal();
    if (e.key === "Enter"  && document.activeElement === editInput) saveEdit();
    if (e.key === "Escape") closeLightbox();
  });
  if (editInput) {
    editInput.addEventListener("input", () => {
      if (editInput.value.trim() && editError) editError.classList.add("hidden");
    });
  }

  // ── Init tasks ──
  tasks = loadTasks();
  render();

  /* ============================================================
     SECTION H — ALBUM MINI FOTO
     Stores up to 20 compressed photos (max 800px, JPEG 0.7).
     Each entry: { id, src (compressed dataUrl), caption, createdAt }
     ============================================================ */

  const ALBUM_MAX     = 20;
  const ALBUM_MAX_PX  = 800;
  const ALBUM_QUALITY = 0.7;

  // ── DOM refs ──
  const albumInput   = document.getElementById("albumInput");
  const albumGrid    = document.getElementById("albumGrid");
  const albumEmpty   = document.getElementById("albumEmpty");
  const albumCount   = document.getElementById("albumCount");
  const albumError   = document.getElementById("albumError");
  const albumLightbox        = document.getElementById("albumLightbox");
  const albumLightboxOverlay = document.getElementById("albumLightboxOverlay");
  const albumLightboxClose   = document.getElementById("albumLightboxClose");
  const albumLightboxImg     = document.getElementById("albumLightboxImg");
  const albumLightboxCaption = document.getElementById("albumLightboxCaption");

  // ── Persistence ──
  function loadAlbum()      { return lsGet("album", []); }
  function saveAlbum(arr)   { lsSet("album", arr); }

  /**
   * Compress an image File to a dataURL using <canvas>.
   * Max dimension: ALBUM_MAX_PX px. Quality: ALBUM_QUALITY.
   * @param {File} file
   * @param {function(string)} callback  receives compressed dataURL
   */
  function compressImage(file, callback) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > ALBUM_MAX_PX || height > ALBUM_MAX_PX) {
        if (width > height) { height = Math.round(height * ALBUM_MAX_PX / width); width = ALBUM_MAX_PX; }
        else                { width  = Math.round(width  * ALBUM_MAX_PX / height); height = ALBUM_MAX_PX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", ALBUM_QUALITY));
    };
    img.src = url;
  }

  /** Show album error, auto-hide after 3s */
  function showAlbumError(msg) {
    if (!albumError) return;
    albumError.textContent = msg;
    albumError.classList.remove("hidden");
    setTimeout(() => albumError.classList.add("hidden"), 3000);
  }

  /** Re-render the album grid from storage */
  function renderAlbum() {
    if (!albumGrid) return;
    const photos = loadAlbum();
    albumGrid.innerHTML = "";

    // Empty state
    if (albumEmpty) albumEmpty.classList.toggle("hidden", photos.length > 0);

    // Count badge
    if (albumCount) {
      if (photos.length > 0) {
        albumCount.textContent = `${photos.length}/${ALBUM_MAX}`;
        albumCount.classList.remove("hidden");
      } else {
        albumCount.classList.add("hidden");
      }
    }

    // Disable/enable add button at limit
    if (albumInput) albumInput.disabled = photos.length >= ALBUM_MAX;

    photos.forEach((photo) => albumGrid.appendChild(buildAlbumItem(photo)));
  }

  /**
   * Build one album card element.
   * @param {{ id:string, src:string, caption:string, createdAt:number }} photo
   */
  function buildAlbumItem(photo) {
    const item = document.createElement("div");
    item.className = "album-item";
    item.dataset.id = photo.id;

    // Thumbnail — click opens lightbox
    const img = document.createElement("img");
    img.className = "album-photo";
    img.src = photo.src;
    img.alt = photo.caption || "Album foto";
    img.addEventListener("click", () => openLightbox(photo));

    // Caption area
    const captionWrap = document.createElement("div");
    captionWrap.className = "album-caption-wrap";

    const caption = document.createElement("textarea");
    caption.className = "album-caption";
    caption.rows = 2;
    caption.placeholder = "Tulis caption… ✦";
    caption.value = photo.caption || "";
    caption.maxLength = 120;
    // Auto-resize
    caption.addEventListener("input", () => {
      caption.style.height = "auto";
      caption.style.height = caption.scrollHeight + "px";
    });
    // Save on blur
    caption.addEventListener("blur", () => {
      const photos = loadAlbum();
      const p = photos.find((p) => p.id === photo.id);
      if (p) { p.caption = caption.value.trim(); saveAlbum(photos); }
    });
    // Prevent click-through to lightbox
    caption.addEventListener("click", (e) => e.stopPropagation());

    captionWrap.appendChild(caption);

    // Delete button
    const del = document.createElement("button");
    del.className = "album-delete-btn";
    del.setAttribute("aria-label", "Hapus foto ini");
    del.textContent = "✕";
    del.addEventListener("click", () => deleteAlbumPhoto(photo.id));

    item.appendChild(img);
    item.appendChild(captionWrap);
    item.appendChild(del);
    return item;
  }

  /** Delete a photo from album */
  function deleteAlbumPhoto(id) {
    if (!confirm("Hapus foto ini dari album?")) return;
    const photos = loadAlbum().filter((p) => p.id !== id);
    saveAlbum(photos);
    renderAlbum();
  }

  /** Open lightbox with given photo */
  function openLightbox(photo) {
    if (!albumLightbox) return;
    if (albumLightboxImg)     { albumLightboxImg.src = photo.src; albumLightboxImg.alt = photo.caption || "Foto"; }
    if (albumLightboxCaption) albumLightboxCaption.textContent = photo.caption || "";
    albumLightbox.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  /** Close lightbox */
  function closeLightbox() {
    if (!albumLightbox || albumLightbox.classList.contains("hidden")) return;
    albumLightbox.classList.add("hidden");
    document.body.style.overflow = "";
    if (albumLightboxImg) albumLightboxImg.src = "";
  }

  // Lightbox close events
  if (albumLightboxClose)   albumLightboxClose.addEventListener("click", closeLightbox);
  if (albumLightboxOverlay) albumLightboxOverlay.addEventListener("click", closeLightbox);

  // Handle file input
  if (albumInput) {
    albumInput.addEventListener("change", () => {
      const file = albumInput.files[0];
      albumInput.value = "";
      if (!file) return;

      const photos = loadAlbum();
      if (photos.length >= ALBUM_MAX) {
        showAlbumError(`Album sudah penuh (${ALBUM_MAX}/${ALBUM_MAX} foto) 🌙`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showAlbumError("File terlalu besar. Maksimum 10MB.");
        return;
      }

      compressImage(file, (compressed) => {
        photos.push({
          id: `alb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          src: compressed,
          caption: "",
          createdAt: Date.now(),
        });
        saveAlbum(photos);
        renderAlbum();
      });
    });
  }

  // Init album
  renderAlbum();

})();
