/* ============================================
   TODAY AT A GLANCE — weather + next event +
   top todo + habit progress, all in one card.
   Reads from localStorage and from existing
   widget DOM (which other modules populate).
   ============================================ */

const TodayGlance = (() => {
  const escHtml = Utils.escHtml;

  function getTopTodo() {
    const todos = Utils.store.get('eureka-todos') || [];
    const active = todos.filter(t => !t.done);
    if (todos.length === 0) return { text: 'No tasks yet', meta: '' };
    if (active.length === 0) return { text: 'All caught up!', meta: '' };
    const remaining = active.length - 1;
    return {
      text: active[0].text,
      meta: remaining > 0 ? `+${remaining} more` : '',
    };
  }

  function getHabitProgress() {
    const habits = Utils.store.get('eureka-personal-habits') || [];
    if (habits.length === 0) return { text: 'No habits set up', meta: '' };
    const log = Utils.store.get('eureka-personal-habit-log') || {};
    const today = log[Utils.todayKey()] || {};
    const done = habits.filter(h => today[h.id]).length;
    return {
      text: `${done} of ${habits.length} done today`,
      meta: done === habits.length ? '🎉' : '',
    };
  }

  function getWeather() {
    // Read from the Weather widget DOM that Dashboard populates async
    const icon = document.getElementById('weather-icon')?.textContent?.trim() || '🌡️';
    const temp = document.getElementById('weather-temp')?.textContent?.trim() || '--';
    const desc = document.getElementById('weather-desc')?.textContent?.trim() || 'Loading…';
    // The desc contains "Sunny · Wind 5 mph · Humidity 50%" — keep just the first part
    const shortDesc = desc.split('·')[0].trim();
    return { icon, text: `${temp} · ${shortDesc}`, meta: '' };
  }

  function getNextEvent() {
    // Read from the Calendar Events widget DOM that CalendarWidget populates
    const container = document.getElementById('calendar-events');
    if (!container) return { text: 'No events loaded', meta: '' };

    // Find the first .cal-event that isn't past
    const events = container.querySelectorAll('.cal-event');
    for (const ev of events) {
      if (ev.classList.contains('cal-past')) continue;
      const time = ev.querySelector('.cal-time')?.textContent?.trim() || '';
      const title = ev.querySelector('.cal-title')?.textContent?.trim() || '';
      if (!title) continue;
      // Determine if it's today or later by walking back to the section header
      let header = ev.previousElementSibling;
      while (header && !header.classList.contains('cal-section-header')) {
        header = header.previousElementSibling;
      }
      const when = header?.textContent?.trim() || '';
      return { text: title, meta: when === 'TODAY' ? time : `${when} · ${time}` };
    }
    return { text: 'Nothing on your calendar', meta: '' };
  }

  function refresh() {
    const container = document.getElementById('glance-rows');
    if (!container) return;

    const rows = [
      { icon: getWeather().icon, ...getWeather() },
      { icon: '📅', ...getNextEvent() },
      { icon: '✓', ...getTopTodo() },
      { icon: '🔥', ...getHabitProgress() },
    ];

    container.innerHTML = rows.map(r => `
      <div class="glance-row">
        <span class="glance-icon">${r.icon}</span>
        <span class="glance-text">${escHtml(r.text)}</span>
        ${r.meta ? `<span class="glance-meta">${escHtml(r.meta)}</span>` : ''}
      </div>
    `).join('');
  }

  function init() {
    refresh();
    // Re-read every 30s so weather/events catch up after their async loads,
    // and todos/habits stay current as they change in other tabs.
    setInterval(refresh, 30000);
  }

  return { init, refresh };
})();
