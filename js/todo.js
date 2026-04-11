/* ============================================
   TODO LIST + GOOGLE TASKS MODULE
   ============================================ */

const TodoList = (() => {
  const escHtml = Utils.escHtml;

  // ========== TODO LIST ==========
  let todos = Utils.store.get('eureka-todos') || [];
  let todoFilter = 'all';

  function todoSave() { Utils.store.set('eureka-todos', todos); }

  function getActiveListId() {
    const picker = document.getElementById('todo-list-picker');
    return picker ? picker.value : (gt.selectedLists[0]?.id || null);
  }

  function getListName(listId) {
    const l = gt.allLists.find(l => l.id === listId);
    return l ? l.title : '';
  }

  async function addTodo() {
    const input = document.getElementById('todo-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const listId = getActiveListId();
    const todo = { id: String(Date.now()), text, done: false, listId: listId || null, listName: getListName(listId) };

    if (gt.connected && listId) {
      try {
        const created = await gtApiCreate(text, listId);
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

    if (gt.connected && t.googleId && t.listId) {
      try {
        await gtApiUpdate(t.listId, t.googleId, {
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

    if (gt.connected && t && t.googleId && t.listId) {
      try {
        await gtApiDelete(t.listId, t.googleId);
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
        if (t.googleId && t.listId) {
          try { await gtApiDelete(t.listId, t.googleId); } catch {}
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

  // Color for a list name — consistent hue
  function listColor(name) {
    if (!name) return 'var(--text-dim)';
    const n = name.toLowerCase();
    if (n.includes('work') || n.includes('office') || n.includes('job')) return 'var(--cyan)';
    if (n.includes('personal') || n.includes('home') || n.includes('life')) return 'var(--magenta)';
    const hue = name.split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
    return `hsl(${hue}, 70%, 60%)`;
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

    list.innerHTML = filtered.map(t => {
      const tag = t.listName
        ? `<span class="todo-list-tag" style="color:${listColor(t.listName)}">${escHtml(t.listName)}</span>`
        : '';
      return `
      <div class="todo-item ${t.done ? 'done' : ''}" data-id="${escHtml(String(t.id))}">
        <button class="todo-check" data-action="toggle">${t.done ? '✓' : ''}</button>
        <span class="todo-text">${escHtml(t.text)}</span>
        ${tag}
        <button class="todo-delete" data-action="delete">×</button>
      </div>`;
    }).join('');

    if (filtered.length === 0) {
      list.innerHTML = `<div class="todo-empty">${todoFilter === 'done' ? 'Nothing completed yet' : todoFilter === 'active' ? 'All done!' : 'No tasks — add one above'}</div>`;
    }

    const active = todos.filter(t => !t.done).length;
    if (countEl) countEl.textContent = `${active} item${active !== 1 ? 's' : ''} left`;
  }

  function updateListPicker() {
    const picker = document.getElementById('todo-list-picker');
    if (!picker) return;
    if (gt.connected && gt.selectedLists.length > 0) {
      picker.innerHTML = gt.selectedLists.map(l =>
        `<option value="${l.id}">${escHtml(l.title)}</option>`
      ).join('');
      picker.style.display = 'block';
    } else {
      picker.style.display = 'none';
    }
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

  // ========== GOOGLE TASKS (multi-list) ==========
  const gt = {
    token: null,
    clientId: Utils.store.getRaw('eureka-gt-clientid'),
    selectedLists: Utils.store.get('eureka-gt-lists') || [],
    connected: false,
    allLists: [],
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

  async function gtApiCreate(text, listId) {
    const res = await gtApiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks`,
      { method: 'POST', body: JSON.stringify({ title: text, status: 'needsAction' }) }
    );
    return res.json();
  }

  async function gtApiUpdate(listId, taskId, updates) {
    await gtApiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(updates) }
    );
  }

  async function gtApiDelete(listId, taskId) {
    await gtApiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
      { method: 'DELETE' }
    );
  }

  async function gtConnect() {
    gt.clientId = (document.getElementById('gt-client-id')?.value || '').trim();
    if (!gt.clientId) {
      gtSetModalStatus('Enter a Client ID first', false);
      return;
    }
    Utils.store.setRaw('eureka-gt-clientid', gt.clientId);

    gtSetModalStatus('Loading Google auth...', null);
    try { await loadGIS(); } catch (e) {
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

        gtSetModalStatus('Connected! Fetching your task lists...', true);

        try {
          const res = await gtApiFetch('https://www.googleapis.com/tasks/v1/users/@me/lists');
          const data = await res.json();
          gt.allLists = data.items || [];
          renderGTListCheckboxes();
          gtSetModalStatus(`Found ${gt.allLists.length} list(s). Check the ones you want and click Sync.`, true);
        } catch (e) {
          gtSetModalStatus('Connected but failed to fetch lists: ' + e.message, false);
        }

        gtUpdateStatus();
      },
    });

    tokenClient.requestAccessToken();
  }

  function renderGTListCheckboxes() {
    const container = document.getElementById('gt-list-checks');
    if (!container) return;
    const selectedIds = new Set(gt.selectedLists.map(l => l.id));

    container.innerHTML = gt.allLists.map(l => `
      <label class="gt-list-label">
        <input type="checkbox" value="${l.id}" data-title="${escHtml(l.title)}"
          ${selectedIds.has(l.id) ? 'checked' : ''}>
        <span style="color:${listColor(l.title)}">${escHtml(l.title)}</span>
      </label>
    `).join('');
    container.style.display = 'block';
  }

  function readSelectedLists() {
    const checks = document.querySelectorAll('#gt-list-checks input[type=checkbox]:checked');
    gt.selectedLists = Array.from(checks).map(c => ({ id: c.value, title: c.dataset.title }));
    Utils.store.set('eureka-gt-lists', gt.selectedLists);
  }

  async function gtSync() {
    readSelectedLists();

    if (!gt.connected || gt.selectedLists.length === 0) {
      gtSetModalStatus('Connect and check at least one list first', false);
      return;
    }

    gtSetModalStatus('Syncing...', null);

    try {
      // Upload local-only tasks to the first selected list
      const localOnly = todos.filter(t => !t.googleId);
      const defaultList = gt.selectedLists[0];
      for (const t of localOnly) {
        try {
          const created = await gtApiCreate(t.text, defaultList.id);
          t.googleId = created.id;
          t.id = created.id;
          t.listId = defaultList.id;
          t.listName = defaultList.title;
          if (t.done) {
            await gtApiUpdate(defaultList.id, created.id, { status: 'completed' });
          }
        } catch {}
      }

      todos = await gtFetchAllTasks();
      todoSave();
      renderTodos();
      updateListPicker();

      const listNames = gt.selectedLists.map(l => l.title).join(', ');
      gtSetModalStatus(`Synced ${todos.length} task(s) from: ${listNames}`, true);
      gtUpdateStatus();

      clearInterval(gt.refreshInterval);
      gt.refreshInterval = setInterval(gtPullQuiet, 300000);
    } catch (e) {
      gtSetModalStatus('Sync failed: ' + e.message, false);
    }
  }

  async function gtFetchAllTasks() {
    const all = [];
    for (const list of gt.selectedLists) {
      try {
        const res = await gtApiFetch(
          `https://www.googleapis.com/tasks/v1/lists/${list.id}/tasks?maxResults=100&showCompleted=true&showHidden=false`
        );
        const data = await res.json();
        (data.items || []).filter(t => t.title).forEach(t => {
          all.push({ id: t.id, googleId: t.id, text: t.title,
            done: t.status === 'completed', listId: list.id, listName: list.title });
        });
      } catch (e) { console.warn(`Failed to fetch list "${list.title}":`, e); }
    }
    return all;
  }

  async function gtPullQuiet() {
    if (!gt.connected || gt.selectedLists.length === 0) return;
    try { todos = await gtFetchAllTasks(); todoSave(); renderTodos(); } catch {}
  }

  function gtDisconnect() {
    gt.token = null;
    gt.connected = false;
    clearInterval(gt.refreshInterval);
    gtUpdateStatus();
    updateListPicker();
    gtSetModalStatus('Disconnected. Local tasks preserved.', null);
    const container = document.getElementById('gt-list-checks');
    if (container) container.style.display = 'none';
  }

  function gtUpdateStatus() {
    const el = document.getElementById('gt-sync-status');
    if (!el) return;
    if (gt.connected) {
      const n = gt.selectedLists.length;
      el.textContent = `● ${n} list${n !== 1 ? 's' : ''} synced`;
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
    Utils.openModal('gt-modal');
    const input = document.getElementById('gt-client-id');
    if (input) input.value = gt.clientId;
    if (gt.connected && gt.allLists.length > 0) renderGTListCheckboxes();
  }

  function closeGTSettings() { Utils.closeModal('gt-modal'); }

  function init() {
    initTodoEvents();
    renderTodos();
    gtUpdateStatus();
  }

  return {
    init, addTodo, setTodoFilter, clearCompleted,
    openGTSettings, closeGTSettings, gtConnect, gtSync, gtDisconnect,
  };
})();
