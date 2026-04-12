/* ============================================
   TOP STORIES — Hacker News top 5, free API, no key.
   Refreshes every 10 minutes.
   ============================================ */

const News = (() => {
  const escHtml = Utils.escHtml;
  const TOP_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
  const ITEM_URL = id => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
  const COUNT = 5;

  function timeAgo(ts) {
    const sec = Math.floor(Date.now() / 1000 - ts);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  function domain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  }

  async function fetchTop() {
    const container = document.getElementById('news-list');
    if (!container) return;

    try {
      const res = await fetch(TOP_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ids = await res.json();
      const top = ids.slice(0, COUNT);

      const items = await Promise.all(top.map(async id => {
        const r = await fetch(ITEM_URL(id));
        return r.ok ? r.json() : null;
      }));

      render(items.filter(Boolean));
    } catch (e) {
      container.innerHTML = `<div class="news-empty">Couldn't load stories: ${escHtml(e.message)}</div>`;
    }
  }

  function render(items) {
    const container = document.getElementById('news-list');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<div class="news-empty">No stories right now</div>';
      return;
    }

    container.innerHTML = items.map((item, i) => {
      const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
      const dom = domain(item.url || '');
      const meta = [
        dom,
        `▲ ${item.score || 0}`,
        `${item.descendants || 0} comments`,
        timeAgo(item.time),
      ].filter(Boolean).join(' · ');
      return `
      <a class="news-item" href="${escHtml(url)}" target="_blank" rel="noopener">
        <span class="news-rank">${i + 1}</span>
        <span class="news-content">
          <span class="news-title">${escHtml(item.title || '(untitled)')}</span>
          <span class="news-meta">${escHtml(meta)}</span>
        </span>
      </a>`;
    }).join('');
  }

  function init() {
    fetchTop();
    setInterval(fetchTop, 600000); // 10 minutes
  }

  return { init };
})();
