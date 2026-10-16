/* Hub launch map.
   One list so the catalogue, the hash router, and the 404 page
   agree on where a game actually lives. Nicknames (#game2048,
   #grow-op, /voxel-isle) open that game instead of the front door. */
const HubRoutes = (() => {
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
    studio: 'agentic-os.html',
    'eureka-studio': 'agentic-os.html',
    'agentic-os': 'agentic-os.html',
  };

  // In-page views. `arcade` is the catalogue itself.
  const VIEWS = [
    'arcade', 'dashboard', 'productivity', 'orgchart', 'personal',
    'snake', 'maze', 'life', 'tetris', 'breakout', 'asteroids', '2048',
    'minesweeper', 'connect4', 'word5', 'lightcycles', 'pong', 'stacker',
    'crateescape', 'vectordefense', 'wordcascade', 'memorymatrix', 'halloffame',
  ];

  // Hash / slug nicknames that are not the view id.
  const ALIASES = {
    game2048: '2048',
    g2048: '2048',
    hof: 'halloffame',
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
    halloffame: 'Hall of Fame — Eureka Games',
  };

  function norm(raw) {
    return String(raw || '').replace(/^#/, '').split(/[?&]/)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
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

  return { PAGES, VIEWS, ALIASES, TITLES, pageFor, viewFor, titleFor };
})();
