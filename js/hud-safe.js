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

  window.HudSafe = { apply: apply, schedule: schedule };

  function start() {
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    [240, 700, 1500, 3000].forEach(function (ms) { setTimeout(schedule, ms); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
