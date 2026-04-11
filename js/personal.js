/* ============================================
   PERSONAL — Auth gate, Habits, Journal, Mood
   ============================================ */

const Personal = (() => {
  const PREFIX = 'eureka-personal-';
  const get = k => Utils.store.get(PREFIX + k);
  const set = (k, v) => Utils.store.set(PREFIX + k, v);
  const dateKey = Utils.dateKey;
  const today = Utils.todayKey;

  // ========== AUTH ==========
  function hashPin(pin) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) h = ((h << 5) - h + pin.charCodeAt(i)) | 0;
    return 'h_' + Math.abs(h).toString(36);
  }

  function hasPin() { return !!Utils.store.getRaw(PREFIX + 'pin'); }

  function initAuth() {
    const sub = document.getElementById('lock-subtitle');
    if (!hasPin()) {
      if (sub) sub.textContent = 'CREATE YOUR ACCESS CODE';
      const btn = document.getElementById('lock-btn');
      if (btn) btn.textContent = 'SET CODE';
    }
    const input = document.getElementById('lock-input');
    if (input) {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submitPin(); });
      input.focus();
    }
  }

  function submitPin() {
    const input = document.getElementById('lock-input');
    const status = document.getElementById('lock-status');
    if (!input) return;
    const pin = input.value.trim();

    if (pin.length < 3) {
      showStatus('Code must be at least 3 characters', false);
      return;
    }

    if (!hasPin()) {
      // Setting new PIN
      Utils.store.setRaw(PREFIX + 'pin', hashPin(pin));
      showStatus('ACCESS CODE SET', true);
      setTimeout(unlock, 600);
    } else {
      // Verifying PIN
      const stored = Utils.store.getRaw(PREFIX + 'pin');
      if (hashPin(pin) === stored) {
        showStatus('ACCESS GRANTED', true);
        setTimeout(unlock, 500);
      } else {
        showStatus('ACCESS DENIED', false);
        input.value = '';
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 500);
      }
    }
  }

  function showStatus(msg, ok) {
    const el = document.getElementById('lock-status');
    if (el) {
      el.textContent = msg;
      el.className = 'lock-status ' + (ok ? 'lock-ok' : 'lock-err');
    }
  }

  function unlock() {
    const lockEl = document.getElementById('personal-lock');
    const contentEl = document.getElementById('personal-content');
    if (lockEl) lockEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
    initPersonalContent();
    if (typeof Effects !== 'undefined' && Effects.init3DTilt) Effects.init3DTilt();
  }

  function lock() {
    const lockEl = document.getElementById('personal-lock');
    const contentEl = document.getElementById('personal-content');
    if (lockEl) {
      lockEl.style.display = 'flex';
      const input = document.getElementById('lock-input');
      if (input) { input.value = ''; input.focus(); }
      const sub = document.getElementById('lock-subtitle');
      if (sub) sub.textContent = 'ENTER ACCESS CODE';
      const btn = document.getElementById('lock-btn');
      if (btn) btn.textContent = 'ACCESS';
      const status = document.getElementById('lock-status');
      if (status) { status.textContent = ''; status.className = 'lock-status'; }
    }
    if (contentEl) contentEl.style.display = 'none';
  }

  // ========== MOOD ==========
  function logMood(level) {
    const moods = get('moods') || {};
    moods[today()] = { level, time: Date.now() };
    set('moods', moods);
    renderMood();
    document.querySelectorAll('.mood-picker button').forEach((b, i) => {
      b.classList.toggle('selected', (5 - i) === level);
    });
  }

  function renderMood() {
    const todayEl = document.getElementById('mood-today');
    const toggleBtn = document.getElementById('mood-history-toggle');
    if (!todayEl) return;

    const moods = get('moods') || {};
    const emojis = { 5: '😄', 4: '🙂', 3: '😐', 2: '😕', 1: '😢' };
    const labels = { 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Low', 1: 'Rough' };

    const todayEntry = moods[today()];
    if (todayEntry) {
      todayEl.innerHTML = `<span class="mood-today-emoji">${emojis[todayEntry.level]}</span> Feeling <strong>${labels[todayEntry.level]}</strong>`;
      todayEl.style.display = 'block';
      if (toggleBtn) toggleBtn.style.display = 'block';
    } else {
      todayEl.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = 'none';
    }

    // Pre-render history (hidden by default)
    renderMoodHistory();
  }

  function renderMoodHistory() {
    const container = document.getElementById('mood-history');
    if (!container) return;
    const moods = get('moods') || {};
    const emojis = { 5: '😄', 4: '🙂', 3: '😐', 2: '😕', 1: '😢' };

    let html = '<div class="mood-week">';
    const days = Utils.lastNDays(7);
    for (const d of days) {
      const key = dateKey(d);
      const entry = moods[key];
      const diff = Math.round((new Date() - d) / 86400000);
      const dayLabel = diff === 0 ? 'Today' : diff === 1 ? 'Yday' : d.toLocaleDateString('en-US', { weekday: 'short' });

      html += `<div class="mood-day ${entry ? 'mood-has' : ''}">
        <div class="mood-day-emoji">${entry ? emojis[entry.level] : '·'}</div>
        <div class="mood-day-label">${dayLabel}</div>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function toggleMoodHistory() {
    const section = document.getElementById('mood-history-section');
    const btn = document.getElementById('mood-history-toggle');
    if (!section) return;
    const showing = section.style.display !== 'none';
    section.style.display = showing ? 'none' : 'block';
    if (btn) btn.textContent = showing ? 'past entries' : 'hide';
  }

    container.innerHTML = html;
  }

  // ========== HABITS ==========
  let habits = get('habits') || [];
  let habitLog = get('habit-log') || {};

  function habitSave() {
    set('habits', habits);
    set('habit-log', habitLog);
  }

  function addHabit() {
    const input = document.getElementById('habit-input');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    habits.push({ id: Date.now(), name });
    input.value = '';
    habitSave();
    renderHabits();
  }

  function removeHabit(id) {
    habits = habits.filter(h => h.id !== id);
    habitSave();
    renderHabits();
  }

  function toggleHabit(id) {
    const key = today();
    if (!habitLog[key]) habitLog[key] = {};
    habitLog[key][id] = !habitLog[key][id];
    habitSave();
    renderHabits();
  }

  function getStreak(id) {
    let streak = 0;
    const d = new Date();
    // Check if today is done; if not, start from yesterday
    const todayDone = habitLog[dateKey(d)] && habitLog[dateKey(d)][id];
    if (!todayDone) d.setDate(d.getDate() - 1);

    for (let i = 0; i < 365; i++) {
      const key = dateKey(d);
      if (habitLog[key] && habitLog[key][id]) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function renderHabits() {
    const list = document.getElementById('habit-list');
    if (!list) return;
    const key = today();
    const log = habitLog[key] || {};

    // Week header
    let html = '<div class="habit-week-header"><span class="habit-name-spacer"></span>';
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      html += `<span class="habit-day-head">${i === 0 ? 'T' : d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>`;
    }
    html += '<span class="habit-streak-head">🔥</span></div>';

    html += habits.map(h => {
      const done = !!log[h.id];
      const streak = getStreak(h.id);

      // Week dots
      let weekDots = '';
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dKey = dateKey(d);
        const dDone = habitLog[dKey] && habitLog[dKey][h.id];
        weekDots += `<span class="habit-dot ${dDone ? 'habit-dot-done' : ''}">${dDone ? '●' : '○'}</span>`;
      }

      return `<div class="habit-item ${done ? 'done' : ''}">
        <button class="habit-check" onclick="Personal.toggleHabit(${h.id})">${done ? '✓' : ''}</button>
        <span class="habit-name">${escHtml(h.name)}</span>
        ${weekDots}
        <span class="habit-streak">${streak}</span>
        <button class="habit-remove" onclick="Personal.removeHabit(${h.id})">×</button>
      </div>`;
    }).join('');

    if (habits.length === 0) {
      html += '<div class="todo-empty">No habits yet — add one below</div>';
    }

    list.innerHTML = html;
  }

  function initHabitEvents() {
    const input = document.getElementById('habit-input');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });
  }

  // ========== JOURNAL ==========
  let journalDate = new Date();
  let journalSaveTimeout = null;

  function journalKey() { return dateKey(journalDate); }

  function loadJournalEntry() {
    const area = document.getElementById('journal-area');
    const dateEl = document.getElementById('journal-date');
    if (!area || !dateEl) return;

    const entries = get('journal') || {};
    area.value = entries[journalKey()] || '';
    dateEl.textContent = journalDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    updateJournalWords();
  }

  function saveJournalEntry() {
    const area = document.getElementById('journal-area');
    if (!area) return;
    const entries = get('journal') || {};
    const text = area.value.trim();
    if (text) {
      entries[journalKey()] = area.value;
    } else {
      delete entries[journalKey()];
    }
    set('journal', entries);
  }

  function prevDay() {
    saveJournalEntry();
    journalDate.setDate(journalDate.getDate() - 1);
    loadJournalEntry();
  }

  function nextDay() {
    saveJournalEntry();
    const tmr = new Date(journalDate);
    tmr.setDate(tmr.getDate() + 1);
    if (tmr <= new Date()) {
      journalDate = tmr;
      loadJournalEntry();
    }
  }

  function updateJournalWords() {
    const area = document.getElementById('journal-area');
    const el = document.getElementById('journal-words');
    if (!area || !el) return;
    const words = area.value.trim() ? area.value.trim().split(/\s+/).length : 0;
    el.textContent = words;
  }

  function initJournalEvents() {
    const area = document.getElementById('journal-area');
    if (area) {
      area.addEventListener('input', () => {
        updateJournalWords();
        clearTimeout(journalSaveTimeout);
        journalSaveTimeout = setTimeout(saveJournalEntry, 800);
      });
    }
  }

  const escHtml = Utils.escHtml;

  // ========== INIT ==========
  function initPersonalContent() {
    renderMood();
    renderHabits();
    initHabitEvents();
    journalDate = new Date();
    loadJournalEntry();
    initJournalEvents();

    // Highlight today's mood if already set
    const moods = get('moods') || {};
    const todayMood = moods[today()];
    if (todayMood) {
      document.querySelectorAll('.mood-picker button').forEach((b, i) => {
        b.classList.toggle('selected', (5 - i) === todayMood.level);
      });
    }
  }

  function init() {
    initAuth();
  }

  return {
    init, submitPin, lock,
    logMood, toggleMoodHistory,
    toggleHabit, addHabit, removeHabit,
    prevDay, nextDay,
  };
})();
