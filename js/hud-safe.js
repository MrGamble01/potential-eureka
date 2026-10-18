/* Shared HUD safe zone.
   Measures the bars that already own the edges and writes
   --hud-top-safe and --hud-bottom-safe on the document.
   The booth tab, the announcer, and the toast stacks read
   those variables. Game logic stays where it is. */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var TOP = [
    '.ea-back', '.ea-topbar', '.aow-topbar', '.aow-battle-strip',
    '#status-bar', '#cash-hud', '#topbar', '#top-bar', '#hud',
    '#heat-hud', '#market-hud'
  ];
  var BOTTOM = [
    '.aow-actionbar', '.aow-tabs', '#aow-spawn-list', '.aow-hint',
    '#buildbar', '#buildtabs', '#hotbar', '#lab-tray', '#vox-tray',
    '#next-action-card', '#sprint-btn', '#ipo-btn', '#tp-toggle',
    '#elevator-btn', '#menu', '#speedctl', '#bottom-bar'
  ];

  function shown(el) {
    if (!el || el.hidden) return null;
    if (el.id === 'arcade-ai-root' || el.id === 'arcade-ai-ticker' || el.id === 'arcade-ai-launch') return null;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    if (r.height > innerHeight * 0.55) return null;
    return r;
  }

  function apply() {
    var pad = 8;
    var top = 8;
    TOP.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        var r = shown(el);
        if (!r) return;
        if (r.top > innerHeight * 0.45) return;
        if (r.bottom + pad > top) top = Math.round(r.bottom + pad);
      });
    });
    var bottom = 18;
    BOTTOM.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        var r = shown(el);
        if (!r) return;
        if (r.bottom < innerHeight * 0.45) return;
        var inset = Math.round(innerHeight - r.top + pad);
        if (inset > bottom) bottom = inset;
      });
    });
    var ceiling = Math.round(innerHeight * 0.72);
    if (bottom > ceiling) bottom = ceiling;
    if (top > innerHeight * 0.45) top = Math.round(innerHeight * 0.45);
    var root = document.documentElement;
    root.style.setProperty('--hud-top-safe', top + 'px');
    root.style.setProperty('--hud-bottom-safe', bottom + 'px');
    liftToasts();
  }

  function shownToast(el) {
    if (!el || el.hidden) return null;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return r;
  }

  // Achievement toasts sit above the bars. When the announcer is up
  // they sit above that line too, and a career banner sits above any
  // game toast already in the band. Pointer events stay off.
  function liftToasts() {
    var root = document.documentElement;
    var pad = 8;
    var bottom = parseFloat(getComputedStyle(root).getPropertyValue('--hud-bottom-safe')) || 96;
    var ticker = document.getElementById('arcade-ai-ticker');
    var tr = shownToast(ticker);
    if (tr && tr.top > innerHeight * 0.2 && tr.bottom > innerHeight * 0.35) {
      var above = Math.round(innerHeight - tr.top + pad);
      if (above > bottom) bottom = above;
    }
    var topSafe = parseFloat(getComputedStyle(root).getPropertyValue('--hud-top-safe')) || 56;
    var ceiling = Math.round(innerHeight - topSafe - 56);
    if (ceiling > 18 && bottom > ceiling) bottom = ceiling;
    root.style.setProperty('--hud-toast-bottom', Math.round(bottom) + 'px');
    var extra = 0;
    ['#toasts', '#toast-container', '.aow-achievement-toasts'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!el.querySelector('.toast, .aow-ach-toast')) return;
        var r = shownToast(el);
        if (r && r.height + pad > extra) extra = Math.round(r.height + pad);
      });
    });
    var career = bottom + extra;
    if (ceiling > 18 && career > ceiling) career = Math.max(bottom, ceiling);
    root.style.setProperty('--hud-career-bottom', Math.round(career) + 'px');
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      apply();
    });
  }

  window.HudSafe = { apply: apply, schedule: schedule, liftToasts: liftToasts };

  function start() {
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    [240, 700, 1500, 3000].forEach(function (ms) { setTimeout(schedule, ms); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
