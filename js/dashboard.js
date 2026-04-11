/* ============================================
   DASHBOARD — Clock, Calendar, Stats, Quotes
   ============================================ */

const Dashboard = (() => {
  // ---- CLOCK ----
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    const clockEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
  }

  // ---- CALENDAR ----
  function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    let html = `<div class="calendar-header"><span>${monthName}</span></div>`;
    html += '<div class="calendar-grid">';

    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    dayNames.forEach(d => { html += `<div class="day-name">${d}</div>`; });

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="day other-month">${daysInPrev - i}</div>`;
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const cls = d === today ? 'day today' : 'day';
      html += `<div class="${cls}">${d}</div>`;
    }

    // Next month padding
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="day other-month">${i}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ---- SYSTEM STATS (simulated) ----
  const stats = { cpu: 45, mem: 62, disk: 71, net: 23 };

  function updateStats() {
    Object.keys(stats).forEach(key => {
      // Random walk
      stats[key] += (Math.random() - 0.48) * 8;
      stats[key] = Math.max(5, Math.min(95, stats[key]));

      const fill = document.getElementById(`stat-${key}`);
      const value = document.getElementById(`stat-${key}-val`);
      if (fill) fill.style.width = `${stats[key]}%`;
      if (value) value.textContent = `${Math.round(stats[key])}%`;
    });
  }

  // ---- QUOTES ----
  const quotes = [
    { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "Any sufficiently advanced technology is indistinguishable from magic.", author: "Arthur C. Clarke" },
    { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
    { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
    { text: "It's not a bug — it's an undocumented feature.", author: "Anonymous" },
    { text: "The computer was born to solve problems that did not exist before.", author: "Bill Gates" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "Eureka! I have found it!", author: "Archimedes" },
    { text: "The function of good software is to make the complex appear to be simple.", author: "Grady Booch" },
  ];
  let currentQuote = 0;

  function rotateQuote() {
    currentQuote = (currentQuote + 1) % quotes.length;
    const q = quotes[currentQuote];
    const textEl = document.getElementById('quote-text');
    const authorEl = document.getElementById('quote-author');
    if (textEl) textEl.textContent = `"${q.text}"`;
    if (authorEl) authorEl.textContent = `— ${q.author}`;
  }

  // ---- ACTIVITY GRAPH ----
  const activityData = Array.from({ length: 30 }, () => Math.random() * 80 + 10);

  function updateActivity() {
    activityData.shift();
    activityData.push(Math.random() * 80 + 10);

    const container = document.getElementById('activity-graph');
    if (!container) return;

    container.innerHTML = activityData
      .map(v => `<div class="activity-bar" style="height: ${v}%"></div>`)
      .join('');
  }

  // ---- WEATHER (simulated) ----
  const weatherStates = [
    { icon: '☀️', temp: 72, desc: 'Clear skies' },
    { icon: '⛅', temp: 65, desc: 'Partly cloudy' },
    { icon: '🌧️', temp: 58, desc: 'Light rain' },
    { icon: '🌤️', temp: 68, desc: 'Mostly sunny' },
    { icon: '⛈️', temp: 54, desc: 'Thunderstorms' },
    { icon: '🌙', temp: 61, desc: 'Clear night' },
  ];

  function updateWeather() {
    const w = weatherStates[Math.floor(Math.random() * weatherStates.length)];
    const iconEl = document.getElementById('weather-icon');
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    if (iconEl) iconEl.textContent = w.icon;
    if (tempEl) tempEl.textContent = `${w.temp}°F`;
    if (descEl) descEl.textContent = w.desc;
  }

  // ---- INIT ----
  function init() {
    updateClock();
    renderCalendar();
    updateStats();
    updateActivity();
    updateWeather();

    currentQuote = Math.floor(Math.random() * quotes.length);
    const q = quotes[currentQuote];
    const textEl = document.getElementById('quote-text');
    const authorEl = document.getElementById('quote-author');
    if (textEl) textEl.textContent = `"${q.text}"`;
    if (authorEl) authorEl.textContent = `— ${q.author}`;

    setInterval(updateClock, 1000);
    setInterval(updateStats, 2000);
    setInterval(updateActivity, 3000);
    setInterval(rotateQuote, 8000);
    setInterval(updateWeather, 30000);
  }

  return { init };
})();
