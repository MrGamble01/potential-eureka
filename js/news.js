/* ============================================
   IN THE NEWS — Wikipedia's curated daily news feed.
   Free, no API key, CORS-friendly. Updates once a day.
   Falls back to yesterday if today's feed isn't ready.
   ============================================ */

const News = (() => {
  const escHtml = Utils.escHtml;
  const COUNT = 5;
  const FEED = (y, m, d) =>
    `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`;

  function feedUrlForOffset(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return FEED(y, m, day);
  }

  // Strip HTML to plain text (Wikipedia's `story` is rich HTML)
  function htmlToText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent.trim().replace(/\s+/g, ' ');
  }

  async function tryFetch(daysAgo) {
    const res = await fetch(feedUrlForOffset(daysAgo));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function fetchTop() {
    const container = document.getElementById('news-list');
    if (!container) return;

    try {
      // Today's feed sometimes isn't published yet — fall back to yesterday.
      let data;
      try { data = await tryFetch(0); }
      catch { data = await tryFetch(1); }

      const items = (data.news || []).slice(0, COUNT).map(n => {
        const text = htmlToText(n.story);
        const link = n.links?.[0]?.content_urls?.desktop?.page || '#';
        const source = n.links?.[0]?.titles?.normalized || '';
        return { text, link, source };
      }).filter(i => i.text);

      render(items);
    } catch (e) {
      container.innerHTML = `<div class="news-empty">Couldn't load news: ${escHtml(e.message)}</div>`;
    }
  }

  function render(items) {
    const container = document.getElementById('news-list');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<div class="news-empty">No stories right now</div>';
      return;
    }

    container.innerHTML = items.map((item, i) => `
      <a class="news-item" href="${escHtml(item.link)}" target="_blank" rel="noopener">
        <span class="news-rank">${i + 1}</span>
        <span class="news-content">
          <span class="news-title">${escHtml(item.text)}</span>
          ${item.source ? `<span class="news-meta">${escHtml(item.source)}</span>` : ''}
        </span>
      </a>
    `).join('');
  }

  function init() {
    fetchTop();
    // Wikipedia's feed only updates once a day, so refresh hourly is plenty.
    setInterval(fetchTop, 3600000);
  }

  return { init };
})();
