/* ============================================
   GAMEPAD — polls a connected controller and dispatches the
   same synthetic KeyboardEvents the Tetris touch pad already
   uses, so every keyboard-driven arcade game (Snake, Tetris,
   Breakout, Asteroids, 2048, Maze, Word Five) gets gamepad
   support for free — no per-game wiring needed.
   ============================================ */

const Gamepad = (() => {
  const AXIS_DEADZONE = 0.5;
  const REPEAT_MS = 110;     // matches the Tetris touch pad's auto-repeat rate
  const INITIAL_DELAY_MS = 380; // mirrors typical OS key-repeat delay before it kicks in

  // Standard-mapping face button indices (D-pad is read directly by index below).
  const FACE_KEY = { 0: ' ', 1: 'Enter', 2: 'c', 3: 'z' };

  const held = {};       // key -> currently down?
  const nextRepeat = {}; // key -> timestamp when the next repeat keydown fires
  let rafId = null;

  function dispatch(type, key, repeat) {
    document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true, repeat: !!repeat }));
  }

  function press(key, now) {
    if (!held[key]) {
      held[key] = true;
      nextRepeat[key] = now + INITIAL_DELAY_MS;
      dispatch('keydown', key, false);
    } else if (now >= nextRepeat[key]) {
      nextRepeat[key] = now + REPEAT_MS;
      dispatch('keydown', key, true);
    }
  }

  function release(key) {
    if (held[key]) {
      held[key] = false;
      dispatch('keyup', key, false);
    }
  }

  function releaseAll() {
    Object.keys(held).forEach(release);
  }

  function poll() {
    rafId = requestAnimationFrame(poll);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.prototype.find.call(pads, p => p && p.connected);
    if (!pad) { releaseAll(); return; }

    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const now = performance.now();
    const pressed = {
      ArrowUp:    ay < -AXIS_DEADZONE || !!(pad.buttons[12] && pad.buttons[12].pressed),
      ArrowDown:  ay >  AXIS_DEADZONE || !!(pad.buttons[13] && pad.buttons[13].pressed),
      ArrowLeft:  ax < -AXIS_DEADZONE || !!(pad.buttons[14] && pad.buttons[14].pressed),
      ArrowRight: ax >  AXIS_DEADZONE || !!(pad.buttons[15] && pad.buttons[15].pressed),
    };
    Object.keys(FACE_KEY).forEach(i => { pressed[FACE_KEY[i]] = !!(pad.buttons[i] && pad.buttons[i].pressed); });

    Object.keys(pressed).forEach(key => { if (pressed[key]) press(key, now); else release(key); });
  }

  function init() {
    if (!navigator.getGamepads || rafId !== null) return;
    rafId = requestAnimationFrame(poll);
  }

  return { init };
})();
