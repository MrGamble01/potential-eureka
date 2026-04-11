/* ============================================
   PRODUCTIVITY — Pomodoro, Todo, Notes, Bookmarks
   ============================================ */

const Productivity = (() => {
  // ========== POMODORO ==========
  const POMO_MODES = {
    focus: { label: 'FOCUS', duration: 25 * 60 },
    short: { label: 'SHORT BREAK', duration: 5 * 60 },
    long:  { label: 'LONG BREAK', duration: 15 * 60 },
  };

  let pomoMode = 'focus';
  let pomoTime = POMO_MODES.focus.duration;
  let pomoRunning = false;
  let pomoInterval = null;
  let pomoSessions = parseInt(localStorage.getItem('eureka-pomo-sessions') || '0');

  function pomoToggle() {
    if (pomoRunning) {
      pomoRunning = false;
      clearInterval(pomoInterval);
    } else {
      pomoRunning = true;
      pomoInterval = setInterval(pomoTick, 1000);
    }
    pomoUpdateUI();
  }

  function pomoTick() {
    pomoTime--;
    if (pomoTime <= 0) {
      pomoBeep();
      clearInterval(pomoInterval);
      pomoRunning = false;
      if (pomoMode === 'focus') {
        pomoSessions++;
        localStorage.setItem('eureka-pomo-sessions', pomoSessions);
        pomoMode = pomoSessions % 4 === 0 ? 'long' : 'short';
      } else {
        pomoMode = 'focus';
      }
      pomoTime = POMO_MODES[pomoMode].duration;
    }
    pomoUpdateUI();
  }

  function pomoSkip() {
    clearInterval(pomoInterval);
    pomoRunning = false;
    if (pomoMode === 'focus') {
      pomoSessions++;
      localStorage.setItem('eureka-pomo-sessions', pomoSessions);
      pomoMode = pomoSessions % 4 === 0 ? 'long' : 'short';
    } else {
      pomoMode = 'focus';
    }
    pomoTime = POMO_MODES[pomoMode].duration;
    pomoUpdateUI();
  }

  function pomoReset() {
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoTime = POMO_MODES[pomoMode].duration;
    pomoUpdateUI();
  }

  function pomoUpdateUI() {
    const m = Math.floor(pomoTime / 60);
    const s = pomoTime % 60;
    const el = id => document.getElementById(id);
    const timeEl = el('pomo-time');
    if (timeEl) timeEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    const modeEl = el('pomo-mode');
    if (modeEl) {
      modeEl.textContent = POMO_MODES[pomoMode].label;
      modeEl.className = `pomo-mode-label pomo-${pomoMode}`;
    }

    const sessEl = el('pomo-sessions');
    if (sessEl) sessEl.textContent = pomoSessions;

    const btn = el('pomo-toggle');
    if (btn) btn.textContent = pomoRunning ? 'Pause' : 'Start';

    const total = POMO_MODES[pomoMode].duration;
    const pct = ((total - pomoTime) / total) * 100;
    const bar = el('pomo-progress');
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.className = `pomo-fill pomo-${pomoMode}`;
    }
  }

  function pomoBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
      // Second beep
      setTimeout(() => {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.frequency.value = 1100;
        g2.gain.setValueAtTime(0.3, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        o2.start(); o2.stop(ctx.currentTime + 0.5);
      }, 300);
    } catch {}
  }

  // ========== TODO LIST ==========
  let todos = JSON.parse(localStorage.getItem('eureka-todos') || '[]');
  let todoFilter = 'all';

  function todoSave() {
    localStorage.setItem('eureka-todos', JSON.stringify(todos));
  }

  function addTodo() {
    const input = document.getElementById('todo-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    todos.push({ id: Date.now(), text, done: false });
    input.value = '';
    todoSave();
    renderTodos();
  }

  function toggleTodo(id) {
    const t = todos.find(t => t.id === id);
    if (t) t.done = !t.done;
    todoSave();
    renderTodos();
  }

  function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    todoSave();
    renderTodos();
  }

  function setTodoFilter(f) {
    todoFilter = f;
    document.querySelectorAll('.todo-filters button').forEach(b => {
      b.classList.toggle('active', b.textContent.toLowerCase() === f);
    });
    renderTodos();
  }

  function clearCompleted() {
    todos = todos.filter(t => !t.done);
    todoSave();
    renderTodos();
  }

  function renderTodos() {
    const list = document.getElementById('todo-list');
    const countEl = document.getElementById('todo-count');
    if (!list) return;

    const filtered = todos.filter(t => {
      if (todoFilter === 'active') return !t.done;
      if (todoFilter === 'done') return t.done;
      return true;
    });

    list.innerHTML = filtered.map(t => `
      <div class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
        <button class="todo-check" data-action="toggle">${t.done ? '✓' : ''}</button>
        <span class="todo-text">${escHtml(t.text)}</span>
        <button class="todo-delete" data-action="delete">×</button>
      </div>
    `).join('');

    if (filtered.length === 0) {
      list.innerHTML = `<div class="todo-empty">${todoFilter === 'done' ? 'Nothing completed yet' : todoFilter === 'active' ? 'All done!' : 'No tasks — add one above'}</div>`;
    }

    const active = todos.filter(t => !t.done).length;
    if (countEl) countEl.textContent = `${active} item${active !== 1 ? 's' : ''} left`;
  }

  function initTodoEvents() {
    const input = document.getElementById('todo-input');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

    const list = document.getElementById('todo-list');
    if (list) list.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const item = btn.closest('.todo-item');
      const id = parseInt(item.dataset.id);
      if (btn.dataset.action === 'toggle') toggleTodo(id);
      if (btn.dataset.action === 'delete') deleteTodo(id);
    });
  }

  // ========== QUICK NOTES ==========
  let notesSaveTimeout = null;

  function initNotes() {
    const area = document.getElementById('notes-area');
    if (!area) return;
    area.value = localStorage.getItem('eureka-notes') || '';
    updateNotesCount();
    area.addEventListener('input', () => {
      updateNotesCount();
      clearTimeout(notesSaveTimeout);
      notesSaveTimeout = setTimeout(() => {
        localStorage.setItem('eureka-notes', area.value);
      }, 500);
    });
  }

  function updateNotesCount() {
    const area = document.getElementById('notes-area');
    const el = document.getElementById('notes-chars');
    if (area && el) el.textContent = area.value.length;
  }

  // ========== BOOKMARKS ==========
  let bookmarks = JSON.parse(localStorage.getItem('eureka-bookmarks') || '[]');

  function bookmarkSave() {
    localStorage.setItem('eureka-bookmarks', JSON.stringify(bookmarks));
  }

  function addBookmark() {
    const form = document.getElementById('bookmark-form');
    if (form.style.display === 'none') {
      form.style.display = 'flex';
      document.getElementById('bm-name').focus();
      return;
    }
    const name = document.getElementById('bm-name').value.trim();
    const url = document.getElementById('bm-url').value.trim();
    if (!name || !url) return;
    bookmarks.push({ id: Date.now(), name, url: url.startsWith('http') ? url : 'https://' + url });
    document.getElementById('bm-name').value = '';
    document.getElementById('bm-url').value = '';
    form.style.display = 'none';
    bookmarkSave();
    renderBookmarks();
  }

  function deleteBookmark(id) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    bookmarkSave();
    renderBookmarks();
  }

  function renderBookmarks() {
    const grid = document.getElementById('bookmarks-grid');
    if (!grid) return;

    grid.innerHTML = bookmarks.map(b => {
      const initial = b.name.charAt(0).toUpperCase();
      const hue = b.name.split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
      return `<a href="${escHtml(b.url)}" target="_blank" rel="noopener" class="bookmark-tile" title="${escHtml(b.url)}">
        <div class="bookmark-icon" style="color: hsl(${hue}, 80%, 60%)">${initial}</div>
        <div class="bookmark-name">${escHtml(b.name)}</div>
        <button class="bookmark-del" onclick="event.preventDefault();event.stopPropagation();Productivity.deleteBookmark(${b.id})">×</button>
      </a>`;
    }).join('');

    grid.innerHTML += `<button class="bookmark-tile bookmark-add" onclick="Productivity.addBookmark()">
      <div class="bookmark-icon">+</div>
      <div class="bookmark-name">Add</div>
    </button>`;
  }

  function initBookmarkEvents() {
    const nameInput = document.getElementById('bm-name');
    const urlInput = document.getElementById('bm-url');
    if (nameInput) nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('bm-url').focus(); });
    if (urlInput) urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBookmark(); });
  }

  // ========== UTIL ==========
  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ========== INIT ==========
  function init() {
    pomoUpdateUI();
    initTodoEvents();
    renderTodos();
    initNotes();
    renderBookmarks();
    initBookmarkEvents();
  }

  return {
    init,
    pomoToggle, pomoSkip, pomoReset,
    addTodo, setTodoFilter, clearCompleted,
    addBookmark, deleteBookmark,
  };
})();
