/* ============================================
   BOOKMARKS MODULE
   ============================================ */

const Bookmarks = (() => {
  const escHtml = Utils.escHtml;

  let bookmarks = Utils.store.get('eureka-bookmarks') || [];

  function bookmarkSave() { Utils.store.set('eureka-bookmarks', bookmarks); }

  function add() {
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

  function deleteFn(id) {
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
    if (urlInput) urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  }

  function init() {
    renderBookmarks();
    initBookmarkEvents();
  }

  return { init, add, delete: deleteFn };
})();
