/* ============================================
   BOOKMARKS MODULE
   ============================================ */

const Bookmarks = (() => {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw;
    let url;
    try { url = new URL(withScheme); } catch (e) { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  }

  function tileHtml(b) {
    const url = safeUrl(b.url);
    const id = Number(b.id);
    if (!url || !Number.isFinite(id)) return '';
    const name = String(b.name || '');
    const initial = (name.charAt(0) || '?').toUpperCase();
    const hue = name.split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
    return `<a href="${esc(url)}" target="_blank" rel="noopener" class="bookmark-tile" title="${esc(url)}">
        <div class="bookmark-icon" style="color: hsl(${hue}, 80%, 60%)">${esc(initial)}</div>
        <div class="bookmark-name">${esc(name)}</div>
        <button class="bookmark-del" type="button" aria-label="${esc('Remove ' + name)}" onclick="event.preventDefault();event.stopPropagation();Productivity.deleteBookmark(${id})">×</button>
      </a>`;
  }

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
    const url = safeUrl(document.getElementById('bm-url').value);
    if (!name || !url) return;
    bookmarks.push({ id: Date.now(), name, url });
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

    grid.innerHTML = bookmarks.map(tileHtml).join('');

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

  return { init, add, delete: deleteFn, tileHtml, safeUrl };
})();
