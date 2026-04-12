/* ============================================
   GOOGLE TASKS MODULE
   OAuth + REST sync for multiple Google Tasks lists.
   Binds to a host (TodoList) via bindHost().
   ============================================ */

const GoogleTasks = (() => {
  const escHtml = Utils.escHtml;

  const gt = {
    token: null,
    clientId: Utils.store.getRaw('eureka-gt-clientid'),
    selectedLists: Utils.store.get('eureka-gt-lists') || [],
    connected: false,
    allLists: [],
    refreshInterval: null,
  };

  // Host (TodoList) binding: { getTodos, setTodos, render, save }
  let host = null;
  function bindHost(h) { host = h; }

  // ---- public state accessors ----
  function isConnected() { return gt.connected; }
  function selectedLists() { return gt.selectedLists; }

  function getActiveListId() {
    const picker = document.getElementById('todo-list-picker');
    return picker ? picker.value : (gt.selectedLists[0]?.id || null);
  }

  function getListName(listId) {
    const l = gt.allLists.find(l => l.id === listId);
    return l ? l.title : '';
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

  // ---- REST API ----
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

  async function apiFetch(url, opts = {}) {
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
      updateStatus();
      throw new Error('Token expired — reconnect via settings');
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res;
  }

  async function createTask(text, listId) {
    const res = await apiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks`,
      { method: 'POST', body: JSON.stringify({ title: text, status: 'needsAction' }) }
    );
    return res.json();
  }

  async function updateTask(listId, taskId, updates) {
    await apiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(updates) }
    );
  }

  async function deleteTask(listId, taskId) {
    await apiFetch(
      `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
      { method: 'DELETE' }
    );
  }

  async function fetchAllTasks() {
    const all = [];
    for (const list of gt.selectedLists) {
      try {
        const res = await apiFetch(
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

  // ---- connect/sync/disconnect ----
  async function connect() {
    gt.clientId = (document.getElementById('gt-client-id')?.value || '').trim();
    if (!gt.clientId) {
      setModalStatus('Enter a Client ID first', false);
      return;
    }
    Utils.store.setRaw('eureka-gt-clientid', gt.clientId);

    setModalStatus('Loading Google auth...', null);
    try { await loadGIS(); } catch (e) {
      setModalStatus('Failed to load Google auth library. Are you online?', false);
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: gt.clientId,
      scope: 'https://www.googleapis.com/auth/tasks',
      callback: async (response) => {
        if (response.error) {
          setModalStatus('Auth failed: ' + (response.error_description || response.error), false);
          return;
        }
        gt.token = response.access_token;
        gt.connected = true;

        setModalStatus('Connected! Fetching your task lists...', true);

        try {
          const res = await apiFetch('https://www.googleapis.com/tasks/v1/users/@me/lists');
          const data = await res.json();
          gt.allLists = data.items || [];
          renderListCheckboxes();
          setModalStatus(`Found ${gt.allLists.length} list(s). Check the ones you want and click Sync.`, true);
        } catch (e) {
          setModalStatus('Connected but failed to fetch lists: ' + e.message, false);
        }

        updateStatus();
      },
    });

    tokenClient.requestAccessToken();
  }

  function renderListCheckboxes() {
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

  async function sync() {
    readSelectedLists();

    if (!gt.connected || gt.selectedLists.length === 0) {
      setModalStatus('Connect and check at least one list first', false);
      return;
    }

    setModalStatus('Syncing...', null);

    try {
      // Upload local-only tasks to the first selected list
      const localTodos = host.getTodos();
      const localOnly = localTodos.filter(t => !t.googleId);
      const defaultList = gt.selectedLists[0];
      for (const t of localOnly) {
        try {
          const created = await createTask(t.text, defaultList.id);
          t.googleId = created.id;
          t.id = created.id;
          t.listId = defaultList.id;
          t.listName = defaultList.title;
          if (t.done) {
            await updateTask(defaultList.id, created.id, { status: 'completed' });
          }
        } catch {}
      }

      const tasks = await fetchAllTasks();
      host.setTodos(tasks);
      host.save();
      host.render();
      updateListPicker();

      const listNames = gt.selectedLists.map(l => l.title).join(', ');
      setModalStatus(`Synced ${tasks.length} task(s) from: ${listNames}`, true);
      updateStatus();

      clearInterval(gt.refreshInterval);
      gt.refreshInterval = setInterval(pullQuiet, 300000);
    } catch (e) {
      setModalStatus('Sync failed: ' + e.message, false);
    }
  }

  async function pullQuiet() {
    if (!gt.connected || gt.selectedLists.length === 0) return;
    try {
      const tasks = await fetchAllTasks();
      host.setTodos(tasks);
      host.save();
      host.render();
    } catch {}
  }

  function disconnect() {
    gt.token = null;
    gt.connected = false;
    clearInterval(gt.refreshInterval);
    updateStatus();
    updateListPicker();
    setModalStatus('Disconnected. Local tasks preserved.', null);
    const container = document.getElementById('gt-list-checks');
    if (container) container.style.display = 'none';
  }

  // ---- UI: status, picker, modal ----
  function updateStatus() {
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

  function setModalStatus(msg, ok) {
    const el = document.getElementById('gt-modal-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'gt-modal-msg ' + (ok === true ? 'gt-ok' : ok === false ? 'gt-err' : '');
  }

  function openSettings() {
    Utils.openModal('gt-modal');
    const input = document.getElementById('gt-client-id');
    if (input) input.value = gt.clientId;
    if (gt.connected && gt.allLists.length > 0) renderListCheckboxes();
  }

  function closeSettings() { Utils.closeModal('gt-modal'); }

  function init() {
    updateStatus();
    updateListPicker();
  }

  return {
    init, bindHost,
    isConnected, selectedLists, getActiveListId, getListName, listColor,
    createTask, updateTask, deleteTask,
    connect, sync, disconnect, openSettings, closeSettings,
  };
})();
