# Smoke tests

Headless Chromium loads every arcade view and every static page, checks that it renders and reaches a started state, and fails on a product console error or an uncaught exception.

This suite is separate from `tests/headless/`. The battery discovers every script beside `run.sh`, so a smoke file there would have to be registered in that shared list.

```bash
./tests/smoke/run.sh
```

`BASE` overrides the origin (default `http://127.0.0.1:8123`). The script serves the repo root when that origin is not already up.

Three extra targets load the same pages at phone viewports (390×844, 375×667, and 844×390, touch primary). Each hub board and each flagship canvas has to sit fully on screen, keep `touch-action: none` so a swipe plays the game instead of scrolling or zooming the page, and the Tetris and Vector Storm pads have to be on screen. Word Five's keyboard has to fit the width; a short landscape phone can still scroll down to it. Set `CHROME_PATH` when Playwright should launch the system Chrome instead of its own browser.

`agentic-os-chat/client/index.html` is the Vite source for the local chat app. It is not a static page and needs its own server plus an API key, so this suite does not load it. Any other new HTML file or hub view fails the catalog check until it is added here.
