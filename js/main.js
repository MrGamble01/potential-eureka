/* ============================================
   MAIN — view router + boot entry point
   ============================================ */

(() => {
  const navButtons = document.querySelectorAll('nav button');
  const views = document.querySelectorAll('.view');
  const inited = new Set();

  function switchView(name) {
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    views.forEach(v => v.classList.toggle('active', v.id === `view-${name}`));

    if (!inited.has(name)) {
      inited.add(name);
      switch (name) {
        case 'dashboard':    Dashboard.init(); CalendarWidget.init(); break;
        case 'productivity': Productivity.init(); break;
        case 'personal':     Personal.init(); break;
        case 'snake':        SnakeGame.init(); break;
        case 'maze':         MazeGame.init(); break;
        case 'life':         LifeGame.init(); break;
      }
    }
    // Re-init 3D tilt for newly visible widgets
    setTimeout(() => Effects.init3DTilt(), 50);
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  Effects.init().then(() => switchView('dashboard'));
})();
