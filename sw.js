/* ============================================
   EUREKA GAMES — service worker (IDEA-SITE-1)
   Precache the whole arcade so it runs fully
   offline; runtime-cache thumbnails and clips.
   Zero dependencies, hand-maintained list — the
   repo has no build step to generate one.
   ============================================ */

// Bump on any precache-list or caching-strategy change: activate() drops
// every cache that doesn't match, which is how updates roll out.
// v6: rolls out the Flagship Depth campaign (AoW trials/councils/vault,
// Hearthvale raids/mastery/talents/Furrier, Grow Op market/contracts/
// stings/pure batches, Homeless Village weather/dog/regulars/board,
// Tycoon climates/acqui-hires/on-site, Voxel crows/angler/compost, and
// the flagship rival leaderboard) to installed PWAs — cache-first
// shells only refresh when this version changes.
// v7: patch notes land on the hub (index.html inline module + hero button).
const SW_VERSION = 'eureka-v57';  // rolls QA-26 (a corrupt save no longer bricks Hearthvale, Voxel Isle or Grow Op at boot) to installed PWAs
const PRECACHE = SW_VERSION + '-shell';
const RUNTIME = SW_VERSION + '-runtime';

// Everything the arcade needs to boot and play with the network gone.
// Vendored three.js is the big line item (~1.9MB for both copies) — the
// price of the 3D games working offline, and exactly why SITE-1 vendored
// them in the first place.
const SHELL = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.json',
  '/drug-lab.html',
  '/homeless-village.html',
  '/hearthvale.html',
  '/voxel-garden.html',
  '/agentic-os.html',
  '/ageofwar/index.html',
  '/ageofwar/ageofwar.js',
  '/ageofwar/aow.css',
  '/tycoon/index.html',
  '/tycoon/play.html',
  '/vendor/three.module.js',
  '/vendor/three-r128.min.js',
  '/css/arcade-chrome.css',
  '/css/arcade.css',
  '/css/base.css',
  '/css/dashboard.css',
  '/css/effects.css',
  '/css/games.css',
  '/css/orgchart.css',
  '/css/personal.css',
  '/css/productivity.css',
  '/homeless-village/css/game.css',
  '/homeless-village/js/config.js',
  '/homeless-village/js/save.js',
  '/homeless-village/js/scene.js',
  '/homeless-village/js/ui.js',
  '/homeless-village/js/player.js',
  '/homeless-village/js/gameloop.js',
  '/homeless-village/js/main.js',
  '/js/achievements.js',
  '/js/asteroids.js',
  '/js/bookmarks.js',
  '/js/breakout.js',
  '/js/calendar.js',
  '/js/coins.js',
  '/js/connect4.js',
  '/js/daily.js',
  '/js/dashboard.js',
  '/js/effects.js',
  '/js/game2048.js',
  '/js/gamepad.js',
  '/js/life.js',
  '/js/lightcycles.js',
  '/js/maze.js',
  '/js/memorymatrix.js',
  '/js/minesweeper.js',
  '/js/notes.js',
  '/js/orgchart.js',
  '/js/personal-auth.js',
  '/js/personal-content.js',
  '/js/personal.js',
  '/js/pomodoro.js',
  '/js/pong.js',
  '/js/productivity.js',
  '/js/rivals.js',
  '/js/scores.js',
  '/js/sfx.js',
  '/js/snake.js',
  '/js/stacker.js',
  '/js/crateescape.js',
  '/js/telemetry.js',
  '/js/tetris.js',
  '/js/todo.js',
  '/js/vectordefense.js',
  '/js/utils.js',
  '/js/word5.js',
  '/js/wordcascade.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== PRECACHE && k !== RUNTIME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts/GitHub API keep their own fate

  // Navigations: network-first so deploys show up promptly, cache fallback
  // so the arcade opens with no network at all. Vercel serves clean URLs
  // (/drug-lab for /drug-lab.html), so the fallback tries the path, then
  // path + '.html', then the hub itself as a last resort.
  if (req.mode === 'navigate') {
    const fromCache = async () =>
      await caches.match(req, { ignoreSearch: true }) ||
      await caches.match(url.pathname) ||
      await caches.match(url.pathname.replace(/\/$/, '') + '.html') ||
      await caches.match('/index.html');
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        // A 404 with a good cached copy behind it is a cache hit, not an
        // error page. This is what makes clean URLs (/drug-lab) work on
        // hosts without Vercel's cleanUrls rewriting — python http.server
        // included — and offline alike.
        if (!res.ok) {
          const cached = await fromCache();
          if (cached) return cached;
          return res;
        }
        const copy = res.clone();
        caches.open(RUNTIME).then(cache => cache.put(req, copy));
        return res;
      } catch (_) {
        const cached = await fromCache();
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache-first (the shell is versioned by SW_VERSION, so
  // stale entries die at activate, not at fetch), with a runtime cache for
  // anything not precached — thumbnails, hover clips, favicons.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Only cache real successes; opaque/error responses would wedge.
        if (res.ok && (res.type === 'basic' || res.type === 'default')) {
          const copy = res.clone();
          caches.open(RUNTIME).then(cache => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
