(function () {
  const GAMES_CSS = 'css/games.css?v=20261021cabinet';
  const GAME_JS = {
    snake: 'js/snake.js',
    maze: 'js/maze.js',
    life: 'js/life.js',
    tetris: 'js/tetris.js',
    breakout: 'js/breakout.js',
    '2048': 'js/game2048.js',
    asteroids: 'js/asteroids.js',
    minesweeper: 'js/minesweeper.js',
    connect4: 'js/connect4.js',
    word5: 'js/word5.js',
    lightcycles: 'js/lightcycles.js',
    pong: 'js/pong.js',
    stacker: 'js/stacker.js',
    crateescape: 'js/crateescape.js',
    vectordefense: 'js/vectordefense.js',
    wordcascade: 'js/wordcascade.js',
    memorymatrix: 'js/memorymatrix.js',
    inkflip: 'js/inkflip.js',
    gutterlight: 'js/gutterlight.js',
  };
  const TOOLS = {
    dashboard: {
      css: ['css/dashboard.css?v=20261017moments4'],
      js: ['js/dashboard.js', 'js/calendar.js'],
    },
    productivity: {
      css: ['css/productivity.css?v=20261017moments4'],
      js: ['js/pomodoro.js', 'js/todo.js', 'js/notes.js', 'js/bookmarks.js', 'js/productivity.js'],
    },
    personal: {
      css: ['css/personal.css?v=20261017moments4'],
      js: ['js/personal-auth.js', 'js/personal-content.js', 'js/personal.js'],
    },
    orgchart: {
      css: ['css/orgchart.css?v=20261017moments4'],
      js: ['js/orgchart.js'],
    },
  };

  const ready = new Map();

  function load(url, kind) {
    if (ready.has(url)) return ready.get(url);
    const promise = new Promise((resolve, reject) => {
      const el = kind === 'css' ? document.createElement('link') : document.createElement('script');
      if (kind === 'css') {
        el.rel = 'stylesheet';
        el.href = url;
        const anchor = document.querySelector('link[href*="hub-pages.css"]');
        if (anchor) document.head.insertBefore(el, anchor);
        else document.head.appendChild(el);
      } else {
        el.src = url;
        document.head.appendChild(el);
      }
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(url));
    });
    ready.set(url, promise);
    return promise;
  }

  function pack(name) {
    const css = [];
    const js = [];
    if (GAME_JS[name]) {
      css.push(GAMES_CSS);
      js.push(GAME_JS[name]);
    }
    const tool = TOOLS[name];
    if (tool) {
      css.push.apply(css, tool.css);
      js.push.apply(js, tool.js);
    }
    return { css, js };
  }

  // Stylesheet and script requests start together. Scripts stay in
  // listed order so a later file can call the globals of an earlier one
  // once ensure() resolves. init() does not run until both are done.
  function schedule(need, loadFn) {
    const css = Promise.all((need.css || []).map((url) => loadFn(url, 'css')));
    let chain = Promise.resolve();
    (need.js || []).forEach((url) => {
      chain = chain.then(() => loadFn(url, 'js'));
    });
    return Promise.all([css, chain]).then(() => {});
  }

  function ensure(name) {
    return schedule(pack(name), load);
  }

  window.EurekaViews = { ensure, pack, schedule };
})();
