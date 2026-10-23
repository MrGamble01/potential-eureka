/* ============================================
   EUREKA GAMES — service worker (IDEA-SITE-1)
   Precache the whole arcade so it runs fully
   offline; runtime-cache thumbnails and clips.
   Zero dependencies, hand-maintained list — the
   repo has no build step to generate one.
   ============================================ */

// Bump on any precache-list or caching-strategy change: activate() drops
// every cache that doesn't match, which is how updates roll out.
//
// This refill stamps every PR: eureka-YYYYMMDD-HHMM-<slug>. A later
// stamp must be a different string or an installed PWA keeps the stale
// shell. Older trains bumped once at merge so stacked PRs would not
// fight over this line.
// v6: rolls out the Flagship Depth campaign (AoW trials/councils/vault,
// Hearthvale raids/mastery/talents/Furrier, Grow Op market/contracts/
// stings/pure batches, Homeless Village weather/dog/regulars/board,
// Tycoon climates/acqui-hires/on-site, Voxel crows/angler/compost, and
// the flagship rival leaderboard) to installed PWAs — cache-first
// shells only refresh when this version changes.
// v7: patch notes land on the hub (index.html inline module + hero button).
// HV-173: Make room requires a standing tent and wind or sweep lapses the ask.
// HV-172: Soup night serves before Cook spends the breakfast pot.
// HV-171: A scorcher dogwalk pays goodwill without a morale lift.
// HV-170: Rain washes wet mural panels and refuses painting.
// HV-169: Theft takes cardboard with existing stash protections.
// HV-168: Winter garden beds sleep without spending compost or stored rain
// HV-167: Winter halves the scrapyard haul and preserves the toolbox bonus
const SW_VERSION = 'eureka-20261023-1900-rivet';
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
  '/css/hud.css',
  '/css/hud-space.woff2',
  '/css/studio-face.css',
  '/js/hud-safe.js',
  '/js/climax.js',
  '/js/hearthvale-expedition.js',
  '/js/ai/arcade-ai.js',
  '/js/ai/boot.js',
  '/js/ai/inworld.js',
  '/tycoon/beagle-pack.js',
  '/games/ashmarch/index.html',
  '/games/ashmarch/ashmarch.css',
  '/games/ashmarch/ashmarch.js',
  '/games/ledger/index.html',
  '/games/ledger/ledger.css',
  '/games/ledger/ledger.js',
  '/assets/covers/ashmarch.svg',
  '/assets/covers/ledger.svg',
  '/assets/covers/inkflip.svg',
  '/assets/covers/gutterlight.svg',
  '/assets/covers/snip.svg',
  '/assets/covers/peg.svg',
  '/assets/covers/clasp.svg',
  '/assets/covers/rivet.svg',
  '/css/arcade.css',
  '/css/game-cards.css',
  '/css/hub-pages.css',
  '/css/hud-b.css',
  '/css/base.css',
  '/css/dashboard.css',
  '/css/effects.css',
  '/css/feel.css',
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
  '/js/audio.js',
  '/js/achievements.js',
  '/js/asteroids.js',
  '/js/bookmarks.js',
  '/js/breakout.js',
  '/js/calendar.js',
  '/js/coins.js',
  '/js/cosmetics.js',
  '/js/connect4.js',
  '/js/daily.js',
  '/js/dashboard.js',
  '/js/effects.js',
  '/js/feel.js',
  '/js/flag-daily.js',
  '/js/game2048.js',
  '/js/gamepad.js',
  '/js/focus-hold.js',
  '/js/gutterlight.js',
  '/js/inkflip.js',
  '/js/snip.js',
  '/js/peg.js',
  '/js/clasp.js',
  '/js/rivet.js',
  '/js/hub-routes.js',
  '/js/patch-notes.js',
  '/js/view-assets.js',
  '/js/life.js',
  '/js/living-world.js',
  '/js/lightcycles.js',
  '/js/maze.js',
  '/js/memorymatrix.js',
  '/js/moments.js',
  '/js/minesweeper.js',
  '/js/notes.js',
  '/js/orgchart.js',
  '/js/personal-auth.js',
  '/js/personal-content.js',
  '/js/persist.js',
  '/js/progression.js',
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

// cache.addAll() honors the HTTP cache. /css and /js are immutable for a
// year, and this worker matches them with ignoreSearch, so a version
// bump used to precache whatever the browser had stored for the bare
// path. Reload bypasses that and stores the response this install saw.
// cache.put keeps the redirected flag. Chrome will not navigate to a hit
// that still says it was a redirect, so copy the body into a new response.
function settledResponse(res) {
  if (!res || res.type === 'opaqueredirect' || !res.ok) return null;
  if (!res.redirected) return res;
  try {
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } catch (e) { return null; }
}

async function precacheFresh(cache, url) {
  const res = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
  const stored = settledResponse(res);
  if (!stored) throw new Error('precache ' + res.status + ' ' + url);
  await cache.put(url, stored);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => Promise.all(SHELL.map(url => precacheFresh(cache, url))))
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
    const usable = (hit) => hit && !hit.redirected && hit.type !== 'opaqueredirect';
    const fromCache = async () => {
      const hits = [
        await caches.match(req, { ignoreSearch: true }),
        await caches.match(url.pathname),
        await caches.match(url.pathname.replace(/\/$/, '') + '.html'),
        await caches.match('/index.html'),
      ];
      for (let i = 0; i < hits.length; i++) if (usable(hits[i])) return hits[i];
    };
    event.respondWith((async () => {
      try {
        let res = await fetch(req);
        // A navigation fetch uses redirect:manual, so a 308 arrives with no
        // body. Follow it. A 404 with a good cached copy behind it is still
        // a hit, which is what makes clean URLs work on python http.server.
        if (res.type === 'opaqueredirect') {
          res = await fetch(url.pathname + url.search, {
            cache: 'reload',
            credentials: 'same-origin',
            redirect: 'follow',
          });
        }
        const stored = settledResponse(res);
        if (!stored) {
          const cached = await fromCache();
          if (cached) return cached;
          return res;
        }
        const copy = stored.clone();
        caches.open(RUNTIME).then(cache => cache.put(req, copy)).catch(() => {});
        return stored;
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
      if (cached && !cached.redirected && cached.type !== 'opaqueredirect') return cached;
      // Same trap as install: a cache-first miss that fills from the
      // HTTP cache pins the immutable file until the next serial.
      const versioned = /\.(css|js)$/.test(url.pathname);
      const incoming = versioned
        ? fetch(url.pathname + url.search, { cache: 'reload', credentials: 'same-origin' })
        : fetch(req);
      return incoming.then(res => {
        const stored = settledResponse(res);
        if (stored && (stored.type === 'basic' || stored.type === 'default')) {
          const copy = stored.clone();
          caches.open(RUNTIME).then(cache => cache.put(req, copy)).catch(() => {});
          return stored;
        }
        return res;
      });
    })
  );
});
