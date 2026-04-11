/* ============================================
   CALENDAR — Google Calendar integration
   with demo mode fallback
   ============================================ */

const CalendarWidget = (() => {
  const STORAGE_KEY = 'eureka-calendar-config';

  function getConfig() { return Utils.store.get(STORAGE_KEY); }
  function saveConfig(config) { Utils.store.set(STORAGE_KEY, config); }

  // ---- DEMO EVENTS ----
  function generateDemoEvents() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = today.getDay();
    const events = [];

    function t(base, h, m) {
      const d = new Date(base);
      d.setHours(h, m, 0, 0);
      return d;
    }

    // Today
    if (dow >= 1 && dow <= 5) {
      events.push(
        { title: 'Daily Standup', start: t(today,9,0), end: t(today,9,15), cal: 'work' },
        { title: 'Deep Work Block', start: t(today,9,30), end: t(today,11,30), cal: 'work' },
      );
      if (dow === 1) events.push({ title: 'Sprint Planning', start: t(today,14,0), end: t(today,15,0), cal: 'work' });
      if (dow === 2) events.push({ title: 'Design Review', start: t(today,13,0), end: t(today,14,0), cal: 'work' });
      if (dow === 3) events.push({ title: '1:1 with Manager', start: t(today,10,30), end: t(today,11,0), cal: 'work' });
      if (dow === 4) events.push({ title: 'Team Lunch', start: t(today,12,0), end: t(today,13,0), cal: 'work' });
      if (dow === 5) events.push({ title: 'Sprint Retro', start: t(today,15,0), end: t(today,16,0), cal: 'work' });
      events.push({ title: 'Gym', start: t(today,18,0), end: t(today,19,0), cal: 'personal' });
    } else {
      events.push(
        { title: 'Coffee & Side Projects', start: t(today,10,0), end: t(today,12,0), cal: 'personal' },
        { title: 'Brunch', start: t(today,12,30), end: t(today,14,0), cal: 'personal' },
      );
      if (dow === 6) events.push({ title: 'Hiking', start: t(today,15,0), end: t(today,17,0), cal: 'personal' });
    }

    // Tomorrow
    const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
    const tmrDow = tmr.getDay();
    if (tmrDow >= 1 && tmrDow <= 5) {
      events.push(
        { title: 'Daily Standup', start: t(tmr,9,0), end: t(tmr,9,15), cal: 'work' },
        { title: 'Architecture Review', start: t(tmr,11,0), end: t(tmr,12,0), cal: 'work' },
      );
    } else {
      events.push({ title: 'Farmers Market', start: t(tmr,9,0), end: t(tmr,11,0), cal: 'personal' });
    }

    return events.sort((a, b) => a.start - b.start);
  }

  // ---- GOOGLE CALENDAR API ----
  async function fetchGoogleEvents(apiKey, calendars) {
    const now = new Date();
    const timeMin = now.toISOString();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 3);
    const timeMax = endDate.toISOString();

    const allEvents = [];

    for (const cal of calendars) {
      try {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
          + `?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}`
          + `&maxResults=15&singleEvents=true&orderBy=startTime`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();

        (data.items || []).forEach(item => {
          const start = item.start.dateTime ? new Date(item.start.dateTime)
            : new Date(item.start.date + 'T00:00:00');
          const end = item.end.dateTime ? new Date(item.end.dateTime)
            : new Date(item.end.date + 'T23:59:59');
          allEvents.push({
            title: item.summary || '(No title)',
            start, end,
            cal: cal.name || 'calendar',
          });
        });
      } catch (e) {
        console.warn(`Failed to fetch calendar "${cal.name}":`, e);
      }
    }

    return allEvents.sort((a, b) => a.start - b.start);
  }

  // ---- RENDERING ----
  const formatTime = Utils.formatTime;

  function isToday(d) {
    return Utils.dateKey(d) === Utils.todayKey();
  }

  function isTomorrow(d) {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    return d.getFullYear() === tmr.getFullYear() && d.getMonth() === tmr.getMonth() && d.getDate() === tmr.getDate();
  }

  function render(events, isDemo) {
    const container = document.getElementById('calendar-events');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = '<div class="cal-empty">No upcoming events</div>';
      return;
    }

    const now = new Date();
    let html = '';
    let currentSection = '';

    for (const ev of events) {
      let section;
      if (isToday(ev.start)) section = 'TODAY';
      else if (isTomorrow(ev.start)) section = 'TOMORROW';
      else section = ev.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

      if (section !== currentSection) {
        currentSection = section;
        html += `<div class="cal-section-header">${section}</div>`;
      }

      const isPast = ev.end < now;
      const isCurrent = ev.start <= now && ev.end >= now;
      const calClass = ev.cal === 'work' ? 'cal-work' : 'cal-personal';
      const timeClass = isPast ? 'cal-past' : (isCurrent ? 'cal-current' : '');

      html += `<div class="cal-event ${calClass} ${timeClass}">
        <span class="cal-time">${formatTime(ev.start)}</span>
        <span class="cal-dot"></span>
        <span class="cal-title">${ev.title}</span>
        <span class="cal-tag">${ev.cal}</span>
      </div>`;
    }

    if (isDemo) {
      html += `<div class="cal-demo-note">Demo data — click ⚙ to connect Google Calendar</div>`;
    }

    container.innerHTML = html;
  }

  // ---- SETTINGS MODAL ----
  function openSettings() {
    Utils.openModal('calendar-modal');

    const config = getConfig() || { apiKey: '', calendars: [] };
    document.getElementById('cal-api-key').value = config.apiKey || '';

    const list = document.getElementById('cal-list');
    list.innerHTML = '';
    if (config.calendars.length === 0) {
      addCalendarRow('Work', '');
      addCalendarRow('Personal', '');
    } else {
      config.calendars.forEach(c => addCalendarRow(c.name, c.id));
    }
  }

  function closeSettings() {
    Utils.closeModal('calendar-modal');
  }

  function addCalendarRow(name, id) {
    const list = document.getElementById('cal-list');
    const row = document.createElement('div');
    row.className = 'cal-row';
    row.innerHTML = `
      <input type="text" placeholder="Label" value="${name || ''}" class="cal-input cal-name-input">
      <input type="text" placeholder="Calendar ID (email or ID)" value="${id || ''}" class="cal-input cal-id-input">
      <button class="cal-remove-btn" onclick="this.parentElement.remove()" title="Remove">×</button>
    `;
    list.appendChild(row);
  }

  async function saveSettings() {
    const apiKey = document.getElementById('cal-api-key').value.trim();
    const rows = document.querySelectorAll('#cal-list .cal-row');
    const calendars = [];
    rows.forEach(row => {
      const name = row.querySelector('.cal-name-input').value.trim();
      const id = row.querySelector('.cal-id-input').value.trim();
      if (id) calendars.push({ name: name || 'Calendar', id });
    });

    if (apiKey && calendars.length > 0) {
      saveConfig({ apiKey, calendars });
      closeSettings();
      await loadEvents();
    } else if (!apiKey && calendars.every(c => !c.id)) {
      // Clearing config — go back to demo
      Utils.store.remove(STORAGE_KEY);
      closeSettings();
      render(generateDemoEvents(), true);
    } else {
      alert('Please provide both an API key and at least one calendar ID.');
    }
  }

  // ---- LOAD ----
  async function loadEvents() {
    const config = getConfig();
    if (config && config.apiKey && config.calendars.length > 0) {
      try {
        const events = await fetchGoogleEvents(config.apiKey, config.calendars);
        render(events, false);
      } catch {
        render(generateDemoEvents(), true);
      }
    } else {
      render(generateDemoEvents(), true);
    }
  }

  function init() {
    loadEvents();
    // Refresh every 5 minutes
    setInterval(loadEvents, 300000);
  }

  return { init, openSettings, closeSettings, addCalendarRow, saveSettings };
})();
