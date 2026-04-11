/* ============================================
   UTILS — Shared helpers across all modules
   ============================================ */

const Utils = {
  escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // localStorage with JSON
  store: {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    getRaw(key) { return localStorage.getItem(key) || ''; },
    setRaw(key, val) { localStorage.setItem(key, val); },
    remove(key) { localStorage.removeItem(key); },
  },

  // Date helpers
  dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  todayKey() { return Utils.dateKey(new Date()); },
  formatTime(d) {
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  },
  lastNDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  },

  // Modal helpers
  openModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'flex'; },
  closeModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; },
};
