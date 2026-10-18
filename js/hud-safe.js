/* Shared HUD safe zone.
   Measures the bars that already own the edges and writes
   --hud-top-safe and --hud-bottom-safe on the document.
   The booth tab, the announcer, the toast stacks, and the
   Sparks pill read those variables. On the trophy room the
   achievement toast sits under the pill and above the shop.
   Game logic stays where it is. */
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

  // Painted box. A closed phone menu keeps its links in the layout
  // tree inside a zero-height overflow clip, so a raw rect would
  // claim the middle of the trophy room. Ignore that clipped box.
  function painted(el) {
    if (!el || el.hidden) return null;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
    var rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    var r = { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    var node = el.parentElement;
    while (node && node !== document.documentElement) {
      var pcs = getComputedStyle(node);
      if (pcs.display === 'none' || pcs.visibility === 'hidden') return null;
      var clipY = pcs.overflowY === 'hidden' || pcs.overflowY === 'clip' || pcs.overflowY === 'auto' || pcs.overflowY === 'scroll';
      var clipX = pcs.overflowX === 'hidden' || pcs.overflowX === 'clip' || pcs.overflowX === 'auto' || pcs.overflowX === 'scroll';
      if (clipY || clipX) {
        var pr = node.getBoundingClientRect();
        var top = clipY ? Math.max(r.top, pr.top) : r.top;
        var bottom = clipY ? Math.min(r.bottom, pr.bottom) : r.bottom;
        var left = clipX ? Math.max(r.left, pr.left) : r.left;
        var right = clipX ? Math.min(r.right, pr.right) : r.right;
        if (bottom - top < 2 || right - left < 2) return null;
        r = { top: top, bottom: bottom, left: left, right: right, width: right - left, height: bottom - top };
      }
      node = node.parentElement;
    }
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    return r;
  }

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

    // Hub nav, including the centered studio tabs and an open phone menu.
    ['.hub-chrome', '.site-nav', '.arcade-secondary-nav', '.arcade-secondary-nav .sec-link'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        var r = painted(el);
        if (!r) return;
        if (r.top > innerHeight * 0.5) return;
        if (r.height > innerHeight * 0.7) return;
        if (r.bottom + pad > top) top = Math.round(r.bottom + pad);
      });
    });
    if (top > innerHeight * 0.72) top = Math.round(innerHeight * 0.72);

    var root = document.documentElement;
    root.style.setProperty('--hud-top-safe', top + 'px');

    // Trophy room: the achievement toast stacks under the sparks pill,
    // and the shelf pads down when that stack would land on the shop.
    var shop = document.getElementById('spark-shop');
    var sr = shop && painted(shop);
    if (sr) {
      var bandTop = top;
      var pill = painted(document.getElementById('spark-toast'));
      if (pill && pill.bottom + pad > bandTop) bandTop = Math.round(pill.bottom + pad);
      var toastEl = document.querySelector('.career-toast');
      var toastH = 0;
      if (toastEl) {
        var th = toastEl.getBoundingClientRect().height;
        toastH = (th > 24 && th < innerHeight * 0.5) ? Math.round(th) : 72;
      }
      var currentPad = parseFloat(root.style.getPropertyValue('--hud-trophy-pad')) || 0;
      var coveredUntil = toastH ? bandTop + toastH : (pill ? Math.round(pill.bottom) : top);
      var naturalShopTop = sr.top - currentPad;
      var need = Math.round(coveredUntil + pad - naturalShopTop);
      if (need < 0) need = 0;
      root.style.setProperty('--hud-trophy-pad', need + 'px');
      if (toastH) {
        var inset = Math.round(innerHeight - (bandTop + toastH));
        if (inset < 18) inset = 18;
        var room = Math.round(innerHeight - bandTop - 8);
        if (inset > room) inset = room;
        if (inset > bottom) bottom = inset;
      }
    } else if (root.style.getPropertyValue('--hud-trophy-pad')) {
      root.style.setProperty('--hud-trophy-pad', '0px');
    }

    root.style.setProperty('--hud-bottom-safe', bottom + 'px');
    liftToasts();
    watchHub();
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

  function watchHub() {
    var header = document.querySelector('.hub-chrome');
    if (!header || header.getAttribute('data-hud-watch')) return;
    header.setAttribute('data-hud-watch', '1');
    if (window.MutationObserver) {
      new MutationObserver(schedule).observe(header, { attributes: true, attributeFilter: ['class'] });
    }
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
