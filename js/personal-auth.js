/* ============================================
   PERSONAL AUTH — PIN gate
   ============================================ */

const PersonalAuth = (() => {
  const PREFIX = 'eureka-personal-';

  // ========== AUTH ==========
  function hashPin(pin) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) h = ((h << 5) - h + pin.charCodeAt(i)) | 0;
    return 'h_' + Math.abs(h).toString(36);
  }

  function hasPin() { return !!Utils.store.getRaw(PREFIX + 'pin'); }

  function initAuth() {
    const sub = document.getElementById('lock-subtitle');
    if (!hasPin()) {
      if (sub) sub.textContent = 'CREATE YOUR ACCESS CODE';
      const btn = document.getElementById('lock-btn');
      if (btn) btn.textContent = 'SET CODE';
    }
    const input = document.getElementById('lock-input');
    if (input) {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submitPin(); });
      input.focus();
    }
  }

  function submitPin() {
    const input = document.getElementById('lock-input');
    const status = document.getElementById('lock-status');
    if (!input) return;
    const pin = input.value.trim();

    if (pin.length < 3) {
      showStatus('Code must be at least 3 characters', false);
      return;
    }

    if (!hasPin()) {
      // Setting new PIN
      Utils.store.setRaw(PREFIX + 'pin', hashPin(pin));
      showStatus('ACCESS CODE SET', true);
      setTimeout(unlock, 600);
    } else {
      // Verifying PIN
      const stored = Utils.store.getRaw(PREFIX + 'pin');
      if (hashPin(pin) === stored) {
        showStatus('ACCESS GRANTED', true);
        setTimeout(unlock, 500);
      } else {
        showStatus('ACCESS DENIED', false);
        input.value = '';
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 500);
      }
    }
  }

  function showStatus(msg, ok) {
    const el = document.getElementById('lock-status');
    if (el) {
      el.textContent = msg;
      el.className = 'lock-status ' + (ok ? 'lock-ok' : 'lock-err');
    }
  }

  function unlock() {
    const lockEl = document.getElementById('personal-lock');
    const contentEl = document.getElementById('personal-content');
    if (lockEl) lockEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
    PersonalContent.init();
    if (typeof Effects !== 'undefined' && Effects.init3DTilt) Effects.init3DTilt();
  }

  function lock() {
    const lockEl = document.getElementById('personal-lock');
    const contentEl = document.getElementById('personal-content');
    if (lockEl) {
      lockEl.style.display = 'flex';
      const input = document.getElementById('lock-input');
      if (input) { input.value = ''; input.focus(); }
      const sub = document.getElementById('lock-subtitle');
      if (sub) sub.textContent = 'ENTER ACCESS CODE';
      const btn = document.getElementById('lock-btn');
      if (btn) btn.textContent = 'ACCESS';
      const status = document.getElementById('lock-status');
      if (status) { status.textContent = ''; status.className = 'lock-status'; }
    }
    if (contentEl) contentEl.style.display = 'none';
  }

  function init() {
    initAuth();
  }

  return { init, submitPin, lock };
})();
