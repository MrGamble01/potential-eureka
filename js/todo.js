/* ============================================
   TODO LIST MODULE — local CRUD + filtering + render.
   Google Tasks sync lives in google-tasks.js and is
   wired up via GoogleTasks.bindHost() at init time.
   ============================================ */

const TodoList = (() => {
  const escHtml = Utils.escHtml;

  let todos = Utils.store.get('eureka-todos') || [];
  let todoFilter = 'all';

  function todoSave() { Utils.store.set('eureka-todos', todos); }

  async function addTodo() {
    const input = document.getElementById('todo-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const listId = GoogleTasks.getActiveListId();
    const todo = {
      id: String(Date.now()), text, done: false,
      listId: listId || null,
      listName: GoogleTasks.getListName(listId),
    };

    if (GoogleTasks.isConnected() && listId) {
      try {
        const created = await GoogleTasks.createTask(text, listId);
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

    if (GoogleTasks.isConnected() && t.googleId && t.listId) {
      try {
        await GoogleTasks.updateTask(t.listId, t.googleId, {
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

    if (GoogleTasks.isConnected() && t && t.googleId && t.listId) {
      try {
        await GoogleTasks.deleteTask(t.listId, t.googleId);
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

    if (GoogleTasks.isConnected()) {
      for (const t of completed) {
        if (t.googleId && t.listId) {
          try { await GoogleTasks.deleteTask(t.listId, t.googleId); } catch {}
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

    list.innerHTML = filtered.map(t => {
      const tag = t.listName
        ? `<span class="todo-list-tag" style="color:${GoogleTasks.listColor(t.listName)}">${escHtml(t.listName)}</span>`
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

  function init() {
    GoogleTasks.bindHost({
      getTodos: () => todos,
      setTodos: (t) => { todos = t; },
      save: todoSave,
      render: renderTodos,
    });
    initTodoEvents();
    renderTodos();
  }

  return {
    init, addTodo, setTodoFilter, clearCompleted,
  };
})();
