/* Hub launch map and central showcase visibility list.
   One list so the catalogue, the Hall of Fame, daily banners, the hash
   router, and the 404 page agree on which games are shown and where
   every game lives. Unhiding a game is a one-line change to SHOWCASE. */
const HubRoutes = (() => {
  const SHOWCASE = [
    'ageofwar',
    'tycoon',
    'hearthvale',
    'voxel',
    'ashmarch',
    'gutterlight',
    'crateescape',
    'tetris',
  ];

  // Standalone pages. Keys are hashes and URL slugs, lowercase.
  const PAGES = {
    ageofwar: 'ageofwar/',
    'age-of-war': 'ageofwar/',
    tycoon: 'tycoon/play.html',
    'startup-tycoon': 'tycoon/play.html',
    growop: 'drug-lab.html',
    'grow-op': 'drug-lab.html',
    'drug-lab': 'drug-lab.html',
    homeless: 'homeless-village.html',
    'homeless-village': 'homeless-village.html',
    hearthvale: 'hearthvale.html',
    voxel: 'voxel-garden.html',
    voxelisle: 'voxel-garden.html',
    'voxel-isle': 'voxel-garden.html',
    'voxel-garden': 'voxel-garden.html',
    ashmarch: 'games/ashmarch/',
    ledger: 'games/ledger/',
    'the-ledger': 'games/ledger/',
    studio: 'agentic-os.html',
    'eureka-studio': 'agentic-os.html',
    'agentic-os': 'agentic-os.html',
  };

  // In-page views. `arcade` is the catalogue itself.
  const VIEWS = [
    'arcade', 'dashboard', 'productivity', 'orgchart', 'personal', 'trophy',
    'snake', 'maze', 'life', 'tetris', 'breakout', 'asteroids', '2048',
    'minesweeper', 'connect4', 'word5', 'lightcycles', 'pong', 'stacker',
    'crateescape', 'vectordefense', 'wordcascade', 'memorymatrix', 'inkflip',
    'gutterlight', 'halloffame',
  ];

  // Hash / slug nicknames that are not the view id.
  const ALIASES = {
    game2048: '2048',
    g2048: '2048',
    hof: 'halloffame',
    trophies: 'trophy',
    trophyroom: 'trophy',
    'trophy-room': 'trophy',
    career: 'trophy',
    'hall-of-fame': 'halloffame',
    scores: 'halloffame',
    minefield: 'minesweeper',
    mines: 'minesweeper',
    'neon-breaker': 'breakout',
    neonbreaker: 'breakout',
    breaker: 'breakout',
    'vector-storm': 'asteroids',
    vectorstorm: 'asteroids',
    'drop-four': 'connect4',
    dropfour: 'connect4',
    connectfour: 'connect4',
    'word-five': 'word5',
    wordfive: 'word5',
    'light-cycles': 'lightcycles',
    tron: 'lightcycles',
    'crate-escape': 'crateescape',
    sokoban: 'crateescape',
    'vector-defense': 'vectordefense',
    'word-cascade': 'wordcascade',
    cascade: 'wordcascade',
    'memory-matrix': 'memorymatrix',
    simon: 'memorymatrix',
    'maze-runner': 'maze',
    mazerunner: 'maze',
    'game-of-life': 'life',
    conway: 'life',
    gutter: 'gutterlight',
    'table-golf': 'gutterlight',
    reversi: 'inkflip',
  };

  const CATALOG = {
    ageofwar: {
      id: 'ageofwar', name: 'Age of War', title: 'AGE OF WAR',
      page: 'ageofwar', lane: 'long', flagship: true, accent: '#3ddcff',
      poster: 'assets/covers/ageofwar.svg?v=20261026no', posterW: 642, posterH: 280, crop: 'wide',
      clip: 'assets/thumbs/ageofwar.webm', hi: 'ageofwar',
      tags: ['⏳ Hours', 'Strategy', 'Waves'],
      desc: 'March through the ages. Crush the enemy base.',
    },
    tycoon: {
      id: 'tycoon', name: 'Startup Tycoon', title: 'STARTUP TYCOON',
      page: 'tycoon', lane: 'long', accent: '#58A6FF',
      poster: 'assets/covers/tycoon.svg?v=20261026no', posterW: 640, posterH: 400,
      clip: 'assets/thumbs/tycoon.webm', hi: 'tycoon',
      tags: ['⏳ Hours', 'Idle', 'Story'],
      desc: 'Hire, ship, grind your way to IPO.',
    },
    hearthvale: {
      id: 'hearthvale', name: 'Hearthvale', title: 'HEARTHVALE',
      page: 'hearthvale', lane: 'long', dim: true, accent: '#7fbf63',
      poster: 'assets/covers/hearthvale.svg', posterW: 640, posterH: 400,
      hi: 'hearthvale', rid: 'hearthvale-v1',
      tags: ['⏳ Hours', 'Builder', 'Cozy'],
      desc: 'Cozy riverside town — homes, trade, seasons.',
    },
    voxel: {
      id: 'voxel', name: 'Voxel Isle', title: 'VOXEL ISLE',
      page: 'voxel', lane: 'long', dim: true, accent: '#7EC8FF',
      poster: 'assets/covers/voxelisle.svg', posterW: 640, posterH: 400,
      clip: 'assets/thumbs/voxelisle.webm', hi: 'voxelgarden',
      tags: ['⏳ Hours', 'Voxel', 'Cozy'],
      desc: 'Till, plant, and build — a deckhand helps.',
    },
    ashmarch: {
      id: 'ashmarch', name: 'Ashmarch', title: 'ASHMARCH',
      page: 'ashmarch', lane: 'quick', accent: '#8b83ff',
      poster: 'assets/covers/ashmarch.svg?v=20261026no', posterW: 640, posterH: 400,
      tags: ['⏱ Few minutes', 'Story', 'Local'],
      desc: 'Two roads. One chronicle in this browser.',
    },
    gutterlight: {
      id: 'gutterlight', name: 'Gutterlight', title: 'GUTTERLIGHT',
      view: 'gutterlight', lane: 'quick', accent: '#3fb950',
      poster: 'assets/covers/gutterlight.svg?v=20261026no', posterW: 640, posterH: 400,
      hi: 'gutterlight', rid: 'gutter-best',
      tags: ['⏱ Few minutes', 'Putting', 'Nine holes'],
      desc: 'Nine holes. Drag the putt. Mind the water.',
    },
    crateescape: {
      id: 'crateescape', name: 'Crate Escape', title: 'CRATE ESCAPE',
      view: 'crateescape', lane: 'quick', accent: '#58A6FF',
      poster: 'assets/covers/crateescape.svg', posterW: 640, posterH: 560,
      hi: 'crateescape', rid: 'crate-best',
      tags: ['⏱ Few minutes', 'Puzzle', 'Sokoban'],
      desc: 'Push crates onto pads. Undo included.',
    },
    tetris: {
      id: 'tetris', name: 'Tetris', title: 'TETRIS',
      view: 'tetris', lane: 'quick', accent: '#F778BA',
      poster: 'assets/covers/tetris.svg?v=20261026no', posterW: 641, posterH: 482, crop: 'right',
      clip: 'assets/thumbs/tetris.webm', hi: 'tetris', rid: 'tetris-high',
      tags: ['⏱ Few minutes', 'Classic', 'Puzzle'],
      desc: "Stack blocks. Clear lines. Don't top out.",
    },
    homeless: {
      id: 'homeless', name: 'Homeless Village', title: 'HOMELESS VILLAGE',
      page: 'homeless', lane: 'long', dim: true, accent: '#58A6FF',
      poster: 'assets/covers/homeless.svg', posterW: 640, posterH: 400,
      clip: 'assets/thumbs/homeless.webm', hi: 'homeless',
      tags: ['⏳ Hours', 'Survival', 'Idle'],
      desc: 'Survive under the bridge. Build a village.',
    },
    growop: {
      id: 'growop', name: 'Grow Op', title: 'GROW OP',
      page: 'growop', lane: 'long', dim: true, accent: '#3FB950',
      poster: 'assets/covers/growop.svg', posterW: 640, posterH: 400,
      clip: 'assets/thumbs/growop.webm', hi: 'growop',
      tags: ['⏳ Hours', 'Builder', 'Risk'],
      desc: 'Expand room by room — watch the heat.',
    },
    ledger: {
      id: 'ledger', name: 'The Ledger', title: 'THE LEDGER',
      page: 'ledger', lane: 'quick', accent: '#8b83ff',
      poster: 'assets/covers/ledger.svg', posterW: 640, posterH: 400,
      tags: ['⏱ Few minutes', 'Routes', 'Local'],
      desc: 'Move crates yard to corner. Heat brings the authorities.',
    },
    snake: {
      id: 'snake', name: 'Snake', title: 'SNAKE',
      view: 'snake', lane: 'quick', accent: '#6C63FF',
      poster: 'assets/covers/snake.svg', posterW: 512, posterH: 320,
      clip: 'assets/thumbs/snake.webm', hi: 'snake', rid: 'snake-high',
      tags: ['⏱ Few minutes', 'Classic', 'Arcade'],
      desc: "Eat, grow, don't bite yourself.",
    },
    '2048': {
      id: '2048', name: '2048', title: '2048',
      view: '2048', lane: 'quick', accent: '#388bfd',
      poster: 'assets/covers/2048.svg', posterW: 560, posterH: 560, crop: 'mid',
      clip: 'assets/thumbs/2048.webm', hi: 'g2048', rid: 'g2048-best',
      tags: ['⏱ Few minutes', 'Puzzle', 'Numbers'],
      desc: 'Slide, merge, reach 2048.',
    },
    minesweeper: {
      id: 'minesweeper', name: 'Minefield', title: 'MINEFIELD',
      view: 'minesweeper', lane: 'quick', accent: '#58A6FF',
      poster: 'assets/covers/minefield.svg', posterW: 416, posterH: 416,
      hi: 'minesweeper', rid: 'mines-best-beginner',
      tags: ['⏱ Few minutes', 'Puzzle', 'Logic'],
      desc: 'Flag mines. Clear the board. Beat your time.',
    },
    breakout: {
      id: 'breakout', name: 'Neon Breaker', title: 'NEON BREAKER',
      view: 'breakout', lane: 'quick', accent: '#22d3ee',
      poster: 'assets/covers/breakout.svg', posterW: 640, posterH: 463,
      clip: 'assets/thumbs/breakout.webm', hi: 'breakout', rid: 'breakout-high',
      tags: ['⏱ Few minutes', 'Classic', 'Power-ups'],
      desc: 'Smash bricks. Grab power-ups. Chase combos.',
    },
    asteroids: {
      id: 'asteroids', name: 'Vector Storm', title: 'VECTOR STORM',
      view: 'asteroids', lane: 'quick', accent: '#a78bfa',
      poster: 'assets/covers/asteroids.svg', posterW: 640, posterH: 463,
      clip: 'assets/thumbs/asteroids.webm', hi: 'asteroids', rid: 'asteroids-high',
      tags: ['⏱ Few minutes', 'Shooter', 'Vector'],
      desc: 'Drift, thrust, blast splitting rocks.',
    },
    connect4: {
      id: 'connect4', name: 'Drop Four', title: 'DROP FOUR',
      view: 'connect4', lane: 'quick', accent: '#58A6FF',
      poster: 'assets/covers/dropfour.svg', posterW: 434, posterH: 372,
      hi: 'connect4', rid: 'connect4-streak',
      tags: ['⏱ Few minutes', 'Strategy', 'vs AI'],
      desc: 'Connect four against a thinking AI.',
    },
    word5: {
      id: 'word5', name: 'Word Five', title: 'WORD FIVE',
      view: 'word5', lane: 'quick', accent: '#3FB950',
      poster: 'assets/covers/word5.svg', posterW: 300, posterH: 358, crop: 'high',
      hi: 'word5', rid: 'word5-streak',
      tags: ['⏱ Few minutes', 'Puzzle', 'Words'],
      desc: 'Guess the five-letter word in six tries.',
    },
    lightcycles: {
      id: 'lightcycles', name: 'Light Cycles', title: 'LIGHT CYCLES',
      view: 'lightcycles', lane: 'quick', accent: '#22d3ee',
      poster: 'assets/covers/lightcycles.svg', posterW: 640, posterH: 432,
      hi: 'lightcycles', rid: 'cycles-streak',
      tags: ['⏱ Few minutes', 'Duel', '2P'],
      desc: 'Trap the AI — or duel a friend.',
    },
    pong: {
      id: 'pong', name: 'Pong++', title: 'PONG++',
      view: 'pong', lane: 'quick', accent: '#58A6FF',
      poster: 'assets/covers/pong.svg', posterW: 640, posterH: 405,
      hi: 'pong', rid: 'pong-streak',
      tags: ['⏱ Few minutes', 'Duel', '2P'],
      desc: 'Split balls, grow paddles. First to 7.',
    },
    stacker: {
      id: 'stacker', name: 'Stacker', title: 'STACKER',
      view: 'stacker', lane: 'quick', accent: '#58A6FF',
      poster: 'assets/covers/stacker.svg', posterW: 640, posterH: 853, crop: 'low',
      hi: 'stacker', rid: 'stacker-best',
      tags: ['⏱ Few minutes', 'Timing', 'Zen'],
      desc: 'Drop flush. Climb the tower.',
    },
    vectordefense: {
      id: 'vectordefense', name: 'Vector Defense', title: 'VECTOR DEFENSE',
      view: 'vectordefense', lane: 'quick', accent: '#8B83FF',
      poster: 'assets/covers/vectordefense.svg', posterW: 640, posterH: 480,
      hi: 'vectordefense', rid: 'vector-best',
      tags: ['⏱ Few minutes', 'Tower Defense', 'Waves'],
      desc: 'Turrets vs neon raiders. Ten waves.',
    },
    wordcascade: {
      id: 'wordcascade', name: 'Word Cascade', title: 'WORD CASCADE',
      view: 'wordcascade', lane: 'quick', accent: '#3FB950',
      poster: 'assets/covers/wordcascade.svg', posterW: 640, posterH: 640, crop: 'low',
      hi: 'wordcascade', rid: 'cascade-best',
      tags: ['⏱ Few minutes', 'Words', 'Falling'],
      desc: 'Spell falling letters. Chains multiply.',
    },
    memorymatrix: {
      id: 'memorymatrix', name: 'Memory Matrix', title: 'MEMORY MATRIX',
      view: 'memorymatrix', lane: 'quick', accent: '#a78bfa',
      poster: 'assets/covers/memorymatrix.svg', posterW: 640, posterH: 640,
      hi: 'memorymatrix', rid: 'matrix-best',
      tags: ['⏱ Few minutes', 'Memory', 'Simon'],
      desc: 'Echo the lights. How long can you hold?',
    },
    inkflip: {
      id: 'inkflip', name: 'Inkflip', title: 'INKFLIP',
      view: 'inkflip', lane: 'quick', accent: '#8b83ff',
      poster: 'assets/covers/inkflip.svg', posterW: 640, posterH: 400,
      hi: 'inkflip', rid: 'inkflip-best',
      tags: ['⏱ Few minutes', 'Reversi', 'vs House'],
      desc: 'Flip the board. Corners belong to you.',
    },
  };

  // Tab titles. The catalogue keeps the original document title.
  const TITLES = {
    arcade: 'EUREKA GAMES',
    dashboard: 'Dashboard — Eureka Games',
    productivity: 'Productivity — Eureka Games',
    orgchart: 'Studio Crew — Eureka Games',
    personal: 'Personal — Eureka Games',
    snake: 'Snake — Eureka Games',
    maze: 'Maze Runner — Eureka Games',
    life: 'Game of Life — Eureka Games',
    tetris: 'Tetris — Eureka Games',
    breakout: 'Neon Breaker — Eureka Games',
    asteroids: 'Vector Storm — Eureka Games',
    '2048': '2048 — Eureka Games',
    minesweeper: 'Minefield — Eureka Games',
    connect4: 'Drop Four — Eureka Games',
    word5: 'Word Five — Eureka Games',
    lightcycles: 'Light Cycles — Eureka Games',
    pong: 'Pong++ — Eureka Games',
    stacker: 'Stacker — Eureka Games',
    crateescape: 'Crate Escape — Eureka Games',
    vectordefense: 'Vector Defense — Eureka Games',
    wordcascade: 'Word Cascade — Eureka Games',
    memorymatrix: 'Memory Matrix — Eureka Games',
    inkflip: 'Inkflip — Eureka Games',
    gutterlight: 'Gutterlight — Eureka Games',
    halloffame: 'Hall of Fame — Eureka Games',
    trophy: 'Trophy Room — Eureka Games',
  };

  const SHOWCASE_ALIAS = {
    voxelgarden: 'voxel',
    'voxel-garden': 'voxel',
    'voxel-garden.html': 'voxel',
    'hearthvale.html': 'hearthvale',
    'tycoon/play.html': 'tycoon',
    'ageofwar/': 'ageofwar',
    'games/ashmarch/': 'ashmarch',
    clinic: 'homeless',
    'homeless-village.html': 'homeless',
    'drug-lab.html': 'growop',
  };

  function norm(raw) {
    return String(raw || '').replace(/^#/, '').split(/[?&]/)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
  }

  function canonicalId(raw) {
    const key = norm(raw);
    if (!key) return '';
    if (SHOWCASE_ALIAS[key]) return SHOWCASE_ALIAS[key];
    if (ALIASES[key]) return ALIASES[key];
    if (CATALOG[key]) return key;
    return key;
  }

  function isShowcase(raw) {
    const id = canonicalId(raw);
    return !!id && SHOWCASE.indexOf(id) !== -1;
  }

  function hrefOf(entry) {
    if (!entry) return '';
    if (entry.page && PAGES[entry.page]) return PAGES[entry.page];
    if (entry.view) return '#' + entry.view;
    return '';
  }

  function showcaseGames() {
    const list = [];
    for (let i = 0; i < SHOWCASE.length; i++) {
      const entry = CATALOG[SHOWCASE[i]];
      if (!entry) continue;
      list.push(Object.assign({}, entry, { href: hrefOf(entry) }));
    }
    return list;
  }

  function pageFor(raw) {
    const key = norm(raw);
    return key && PAGES[key] ? PAGES[key] : null;
  }

  // null when the token is not a game or a view (and for rival imports #hof=).
  function viewFor(raw) {
    const original = String(raw || '').replace(/^#/, '').split(/[?&]/)[0];
    if (!original || /^hof=/i.test(original)) return null;
    const key = original.toLowerCase();
    if (PAGES[key]) return { kind: 'page', href: PAGES[key] };
    const name = ALIASES[key] || key;
    if (VIEWS.indexOf(name) !== -1) return { kind: 'view', name: name };
    return null;
  }

  function titleFor(name) {
    return TITLES[name] || 'EUREKA GAMES';
  }

  return {
    SHOWCASE,
    CATALOG,
    PAGES,
    VIEWS,
    ALIASES,
    TITLES,
    isShowcase,
    showcaseGames,
    pageFor,
    viewFor,
    titleFor,
  };
})();
if (typeof window !== 'undefined') window.HubRoutes = HubRoutes;
if (typeof module === 'object' && module.exports) module.exports = HubRoutes;
