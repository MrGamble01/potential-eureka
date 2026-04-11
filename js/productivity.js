/* ============================================
   PRODUCTIVITY — Pomodoro, Todo + Google Tasks,
   Notes, Bookmarks
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

  async function addTodo() {
    const input = document.getElementById('todo-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const todo = { id: String(Date.now()), text, done: false };

    if (gt.connected) {
      try {
        const created = await gtApiCreate(text);
        todo.id = created.id;
        todo.googleId = created.id;
      } catch (e) {
        console.warn('GT create failed:', e);
      }
    }

    todos.push(todo);
    input.value = '';
    todoSave();
    renderTodos();
  }

  async function toggleTodo(id) {
    const t = todos.find(t => String(t.id) === String(id));
    if (!t) return;
    t.done = !t.done;

    if (gt.connected && t.googleId) {
      try {
        await gtApiUpdate(t.googleId, {
          status: t.done ? 'completed' : 'needsAction',
        });
      } catch (e) {
        console.warn('GT update failed:', e);
      }
    }

    todoSave();
    renderTodos();
  }

  async function deleteTodo(id) {
    const t = todos.find(t => String(t.id) === String(id));

    if (gt.connected && t && t.googleId) {
      try {
        await gtApiDelete(t.googleId);
      } catch (e) {
        console.warn('GT delete failed:', e);
      }
    }

    todos = todos.filter(t => String(t.id) !== String(id));
    todoSave();
    renderTodos();
  }

  async function clearCompleted() {
    const completed = todos.filter(t => t.done);

    if (gt.connected) {
      for (const t of completed) {
        if (t.googleId) {
          try { await gtApiDelete(t.googleId); } catch {}
        }
      }
    }

    todos = todos.filter(t => !t.done);
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
      <div class="todo-item ${t.done ? 'done' : ''}" data-id="${escHtml(String(t.id))}">
        <button class="todo-check" data-action="toggle">${t.done ? '✓' : ''}</button>
        <span class="todo-text">${escHtml(t.text)}</span>
        ${t.googleId ? '<span class="todo-synced" title="Synced with Google Tasks">↻</span>' : ''}
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
      const id = item.dataset.id;
      if (btn.dataset.action === 'toggle') toggleTodo(id);
      if (btn.dataset.action === 'delete') deleteTodo(id);
    });
  }

  // ========== GOOGLE TASKS ==========
  const gt = {
    token: null,
    clientId: localStorage.getItem('eureka-gt-clientid') || '',
    listId: localStorage.getItem('eureka-gt-listid') || '',
    connected: false,
    lists: [],
  };

  function loadGIS() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve(); return;
      }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load Google auth library'));
      document.head.appendChild(s);
    });
  }

  async function gtApiFetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${gt.token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      gt.connected = false;
      gtUpdateStatus();
      throw new Error('Token expired — reconnect via settings');
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res;
  }

  async function gtApiCreate(text) {
    const res = await gtApiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${gt.listId}/tasks`,
      { method: 'POST', body: JSON.stringify({ title: text, status: 'needsAction' }) }
    );
    return res.json();
  }

  async function gtApiUpdate(taskId, updates) {
    await gtApiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${gt.listId}/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(updates) }
    );
  }

  async function gtApiDelete(taskId) {
    await gtApiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${gt.listId}/tasks/${taskId}`,
      { method: 'DELETE' }
    );
  }

  async function gtConnect() {
    gt.clientId = (document.getElementById('gt-client-id')?.value || '').trim();
    if (!gt.clientId) {
      gtSetModalStatus('Enter a Client ID first', false);
      return;
    }
    localStorage.setItem('eureka-gt-clientid', gt.clientId);

    gtSetModalStatus('Loading Google auth...', null);
    try {
      await loadGIS();
    } catch (e) {
      gtSetModalStatus('Failed to load Google auth library. Are you online?', false);
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: gt.clientId,
      scope: 'https://www.googleapis.com/auth/tasks',
      callback: async (response) => {
        if (response.error) {
          gtSetModalStatus('Auth failed: ' + (response.error_description || response.error), false);
          return;
        }
        gt.token = response.access_token;
        gt.connected = true;

        gtSetModalStatus('Connected! Fetching task lists...', true);

        try {
          const res = await gtApiFetch('https://www.googleapis.com/tasks/v1/users/@me/lists');
          const data = await res.json();
          gt.lists = data.items || [];

          const sel = document.getElementById('gt-list-select');
          if (sel) {
            sel.innerHTML = gt.lists.map(l =>
              `<option value="${l.id}" ${l.id === gt.listId ? 'selected' : ''}>${escHtml(l.title)}</option>`
            ).join('');
            sel.style.display = 'block';
            if (!gt.listId && gt.lists.length > 0) {
              gt.listId = gt.lists[0].id;
            }
          }

          gtSetModalStatus(`Found ${gt.lists.length} list(s). Pick one and click Sync.`, true);
        } catch (e) {
          gtSetModalStatus('Connected but failed to fetch lists: ' + e.message, false);
        }

        gtUpdateStatus();
      },
    });

    tokenClient.requestAccessToken();
  }

  async function gtSync() {
    const sel = document.getElementById('gt-list-select');
    if (sel && sel.value) {
      gt.listId = sel.value;
      localStorage.setItem('eureka-gt-listid', gt.listId);
    }

    if (!gt.connected || !gt.listId) {
      gtSetModalStatus('Connect and select a list first', false);
      return;
    }

    gtSetModalStatus('Syncing...', null);

    try {
      // Upload local-only tasks to Google
      const localOnly = todos.filter(t => !t.googleId);
      for (const t of localOnly) {
        try {
          const created = await gtApiCreate(t.text);
          t.googleId = created.id;
          t.id = created.id;
          if (t.done) {
            await gtApiUpdate(created.id, { status: 'completed' });
          }
        } catch {}
      }

      // Pull all tasks from Google
      const res = await gtApiFetch(
        `https://www.googleapis.com/tasks/v1/lists/${gt.listId}/tasks?maxResults=100&showCompleted=true&showHidden=false`
      );
      const data = await res.json();
      const items = (data.items || []).filter(t => t.title);

      todos = items.map(t => ({
        id: t.id,
        googleId: t.id,
        text: t.title,
        done: t.status === 'completed',
      }));

      todoSave();
      renderTodos();
      gtSetModalStatus(`Synced ${todos.length} task(s)`, true);
      gtUpdateStatus();

      // Auto-refresh every 5 min
      clearInterval(gt.refreshInterval);
      gt.refreshInterval = setInterval(gtPullQuiet, 300000);
    } catch (e) {
      gtSetModalStatus('Sync failed: ' + e.message, false);
    }
  }

  async function gtPullQuiet() {
    if (!gt.connected || !gt.listId) return;
    try {
      const res = await gtApiFetch(
        `https://www.googleapis.com/tasks/v1/lists/${gt.listId}/tasks?maxResults=100&showCompleted=true&showHidden=false`
      );
      const data = await res.json();
      const items = (data.items || []).filter(t => t.title);
      todos = items.map(t => ({
        id: t.id, googleId: t.id, text: t.title, done: t.status === 'completed',
      }));
      todoSave();
      renderTodos();
    } catch {}
  }

  function gtDisconnect() {
    gt.token = null;
    gt.connected = false;
    clearInterval(gt.refreshInterval);
    gtUpdateStatus();
    gtSetModalStatus('Disconnected. Local tasks are preserved.', null);
    const sel = document.getElementById('gt-list-select');
    if (sel) sel.style.display = 'none';
  }

  function gtUpdateStatus() {
    const el = document.getElementById('gt-sync-status');
    if (!el) return;
    if (gt.connected) {
      el.textContent = '● synced';
      el.className = 'gt-status gt-connected';
    } else {
      el.textContent = '';
      el.className = 'gt-status';
    }
  }

  function gtSetModalStatus(msg, ok) {
    const el = document.getElementById('gt-modal-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'gt-modal-msg ' + (ok === true ? 'gt-ok' : ok === false ? 'gt-err' : '');
  }

  function openGTSettings() {
    const modal = document.getElementById('gt-modal');
    if (modal) modal.style.display = 'flex';
    const input = document.getElementById('gt-client-id');
    if (input) input.value = gt.clientId;
    if (gt.connected && gt.lists.length > 0) {
      const sel = document.getElementById('gt-list-select');
      if (sel) sel.style.display = 'block';
    }
  }

  function closeGTSettings() {
    const modal = document.getElementById('gt-modal');
    if (modal) modal.style.display = 'none';
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
    gtUpdateStatus();
  }

  return {
    init,
    pomoToggle, pomoSkip, pomoReset,
    addTodo, setTodoFilter, clearCompleted,
    addBookmark, deleteBookmark,
    openGTSettings, closeGTSettings, gtConnect, gtSync, gtDisconnect,
  };
})();
