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

  // ---- WEATHER (real via Open-Meteo + Geolocation) ----
  const WMO_CODES = {
    0: { icon: '☀️', desc: 'Clear sky' },
    1: { icon: '🌤️', desc: 'Mainly clear' },
    2: { icon: '⛅', desc: 'Partly cloudy' },
    3: { icon: '☁️', desc: 'Overcast' },
    45: { icon: '🌫️', desc: 'Foggy' },
    48: { icon: '🌫️', desc: 'Depositing rime fog' },
    51: { icon: '🌦️', desc: 'Light drizzle' },
    53: { icon: '🌦️', desc: 'Moderate drizzle' },
    55: { icon: '🌧️', desc: 'Dense drizzle' },
    61: { icon: '🌧️', desc: 'Slight rain' },
    63: { icon: '🌧️', desc: 'Moderate rain' },
    65: { icon: '🌧️', desc: 'Heavy rain' },
    71: { icon: '🌨️', desc: 'Slight snow' },
    73: { icon: '🌨️', desc: 'Moderate snow' },
    75: { icon: '❄️', desc: 'Heavy snow' },
    77: { icon: '🌨️', desc: 'Snow grains' },
    80: { icon: '🌦️', desc: 'Slight showers' },
    81: { icon: '🌧️', desc: 'Moderate showers' },
    82: { icon: '🌧️', desc: 'Violent showers' },
    85: { icon: '🌨️', desc: 'Slight snow showers' },
    86: { icon: '❄️', desc: 'Heavy snow showers' },
    95: { icon: '⛈️', desc: 'Thunderstorm' },
    96: { icon: '⛈️', desc: 'Thunderstorm with hail' },
    99: { icon: '⛈️', desc: 'Thunderstorm with heavy hail' },
  };

  let weatherLat = null;
  let weatherLon = null;

  function setWeatherDisplay(icon, temp, desc, location) {
    const iconEl = document.getElementById('weather-icon');
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    const locEl = document.getElementById('weather-location');
    if (iconEl) iconEl.textContent = icon;
    if (tempEl) tempEl.textContent = temp;
    if (descEl) descEl.textContent = desc;
    if (locEl) locEl.textContent = location || '';
  }

  async function fetchWeather(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
        + `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`
        + `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const current = data.current;
      const code = current.weather_code;
      const wmo = WMO_CODES[code] || { icon: '🌡️', desc: `Code ${code}` };
      const temp = `${Math.round(current.temperature_2m)}°F`;
      const wind = `${Math.round(current.wind_speed_10m)} mph`;
      const humidity = `${current.relative_humidity_2m}%`;

      setWeatherDisplay(wmo.icon, temp, `${wmo.desc} · Wind ${wind} · Humidity ${humidity}`, '');

      // Reverse geocode for location name
      fetchLocationName(lat, lon);
    } catch (err) {
      setWeatherDisplay('⚠️', '--°F', `Weather unavailable: ${err.message}`, '');
    }
  }

  async function fetchLocationName(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || '';
      const state = addr.state || '';
      const locEl = document.getElementById('weather-location');
      if (locEl && city) {
        locEl.textContent = state ? `${city}, ${state}` : city;
      }
    } catch (_) {
      // Location name is nice-to-have, not critical
    }
  }

  function initWeather() {
    if (!navigator.geolocation) {
      setWeatherDisplay('📍', '--°F', 'Geolocation not supported', '');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        weatherLat = pos.coords.latitude;
        weatherLon = pos.coords.longitude;
        fetchWeather(weatherLat, weatherLon);
      },
      (err) => {
        setWeatherDisplay('📍', '--°F', 'Location access denied — enable in browser', '');
      },
      { timeout: 10000 }
    );
  }

  function refreshWeather() {
    if (weatherLat !== null && weatherLon !== null) {
      fetchWeather(weatherLat, weatherLon);
    }
  }

  // ---- INIT ----
  function init() {
    updateClock();
    renderCalendar();
    updateStats();
    updateActivity();
    initWeather();

    setInterval(updateClock, 1000);
    setInterval(updateStats, 2000);
    setInterval(updateActivity, 3000);
    setInterval(refreshWeather, 300000); // refresh weather every 5 min
  }

  return { init };
})();
