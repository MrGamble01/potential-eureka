/* ============================================
   GAMEPAD — controller support for the arcade.
   Polls the Gamepad API and translates a standard
   pad into the synthetic KeyboardEvents every game
   already understands (the same trick the Tetris
   touch pad uses), so nothing per-game changes:
     dpad / left stick  →  Arrow keys
     A (bottom button)  →  Space
     B (right button)   →  Escape
     Start              →  Enter
   Held directions auto-repeat like a real keyboard
   (games' own e.repeat guards keep working).
   ============================================ */

const GamepadInput = (() => {
  const AXIS_THRESHOLD = 0.5;
  const REPEAT_DELAY = 250;   // ms before a held direction starts repeating
  const REPEAT_EVERY = 90;    // ms between repeats once it does

  // Standard-layout mapping: button index → key.
  const BUTTON_KEYS = {
    12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight',
    0: ' ', 1: 'Escape', 9: 'Enter',
  };
  const KEY_CODES = {
    'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
    ' ': 'Space', 'Escape': 'Escape', 'Enter': 'Enter',
  };
  const REPEATABLE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  // key → {downAt, lastRepeat} while held (from button OR stick — merged so
  // dpad-up plus stick-up counts as one hold, not two).
  const held = new Map();
  let rafId = null;
  let sawPad = false;

  function fire(key, type, repeat) {
    document.dispatchEvent(new KeyboardEvent(type, {
      key, code: KEY_CODES[key] || key, repeat: !!repeat,
      bubbles: true, cancelable: true,
    }));
  }

  function press(key, now) {
    if (!held.has(key)) {
      held.set(key, { downAt: now, lastRepeat: now });
      fire(key, 'keydown', false);
    }
  }

  function release(key) {
    if (held.has(key)) {
      held.delete(key);
      fire(key, 'keyup', false);
    }
  }

  function poll(now) {
    rafId = requestAnimationFrame(poll);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected !== false) { pad = p; break; }
    if (!pad) {
      // Pad unplugged mid-hold: release everything so no key sticks down.
      if (held.size) for (const key of [...held.keys()]) release(key);
      return;
    }
    if (!sawPad) { sawPad = true; showPill(pad.id); }

    // What the pad wants down this frame.
    const want = new Set();
    for (const [idx, key] of Object.entries(BUTTON_KEYS)) {
      const b = pad.buttons[idx];
      if (b && (typeof b === 'object' ? b.pressed : b === 1)) want.add(key);
    }
    const ax = pad.axes || [];
    if (ax[0] <= -AXIS_THRESHOLD) want.add('ArrowLeft');
    if (ax[0] >=  AXIS_THRESHOLD) want.add('ArrowRight');
    if (ax[1] <= -AXIS_THRESHOLD) want.add('ArrowUp');
    if (ax[1] >=  AXIS_THRESHOLD) want.add('ArrowDown');

    for (const key of want) press(key, now);
    for (const key of [...held.keys()]) if (!want.has(key)) release(key);

    // Keyboard-style auto-repeat for held directions.
    for (const [key, st] of held) {
      if (!REPEATABLE.has(key)) continue;
      if (now - st.downAt >= REPEAT_DELAY && now - st.lastRepeat >= REPEAT_EVERY) {
        st.lastRepeat = now;
        fire(key, 'keydown', true);
      }
    }
  }

  // A small transient pill so plugging in a pad visibly does something.
  function showPill(id) {
    const pill = document.createElement('div');
    pill.setAttribute('role', 'status');
    pill.textContent = '🎮 Controller connected';
    pill.title = id || '';
    pill.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
      'background:rgba(13,17,23,0.92);color:#E6EDF3;border:1px solid rgba(108,99,255,0.5);' +
      'border-radius:20px;padding:8px 18px;font-size:13px;z-index:9999;transition:opacity 0.6s;';
    document.body.appendChild(pill);
    setTimeout(() => { pill.style.opacity = '0'; }, 2600);
    setTimeout(() => pill.remove(), 3400);
  }

  function init() {
    if (rafId !== null) return;
    // Poll unconditionally: getGamepads() on a pad-less machine is a cheap
    // empty-array call, and some browsers only surface pads after a button
    // press with no connect event this page ever sees.
    rafId = requestAnimationFrame(poll);
  }

  return { init };
})();

GamepadInput.init();
