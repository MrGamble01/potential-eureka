/* In-world speakers for Age of War and Homeless Village.
   The figures and the speech bubble live here. The games
   are not edited: Age of War pins stand on the field canvas,
   and the camp figures are meshes the booth adds to the
   existing scene. A click asks the same stub the Booth uses. */

/* seat-speaker:start
   The anchor is the bottom of the round button. The name hangs
   nameH pixels under it. A band (the coach, the weather pill)
   pushes that stack aside. Pushing down onto the tab row is
   refused: the names would sit on Units and Turrets. */
function seatSpeaker(anchor, buttonH, nameH, bands, tabTop) {
  const pad = 8;
  let y = anchor;
  function foot() { return { top: y - buttonH, bottom: y + nameH }; }
  function hits(band) {
    const f = foot();
    return f.top < band.bottom + pad && f.bottom > band.top - pad;
  }
  for (let n = 0; n < 6; n++) {
    let block = null;
    for (let i = 0; i < bands.length; i++) {
      if (bands[i] && hits(bands[i])) { block = bands[i]; break; }
    }
    const f = foot();
    const overTabs = tabTop != null && f.bottom > tabTop - pad;
    if (!block && !overTabs) break;
    if (!block) { y -= f.bottom - tabTop + pad; continue; }
    const down = block.bottom + pad - f.top;
    const up = f.bottom - block.top + pad;
    let shift = (block.top < f.top && down < up * 1.4) ? down : -up;
    if (tabTop != null && shift > 0 && f.bottom + shift > tabTop - pad) shift = -up;
    y += shift;
  }
  return y;
}
/* seat-speaker:end */

/* nudge-speaker:start
   A camp talk button sits on the projected figure. On a tablet that
   point can land on the action column. Step the button off the chrome
   by the shortest gap, then leave it. */
function nudgeSpeaker(left, top, size, panels) {
  const pad = 8;
  let x = left;
  let y = top;
  for (let n = 0; n < 4; n++) {
    let hit = null;
    for (let i = 0; i < panels.length; i++) {
      const b = panels[i];
      if (!b) continue;
      const ix = Math.min(x + size, b.right) - Math.max(x, b.left);
      const iy = Math.min(y + size, b.bottom) - Math.max(y, b.top);
      if (ix > 0 && iy > 0) { hit = b; break; }
    }
    if (!hit) break;
    const leftGap = (x + size) - hit.left;
    const rightGap = hit.right - x;
    const upGap = (y + size) - hit.top;
    const downGap = hit.bottom - y;
    if (leftGap <= rightGap && leftGap <= upGap && leftGap <= downGap) x -= leftGap + pad;
    else if (rightGap <= upGap && rightGap <= downGap) x += rightGap + pad;
    else if (upGap <= downGap) y -= upGap + pad;
    else y += downGap + pad;
  }
  return { x: x, y: y };
}
/* nudge-speaker:end */

(function () {
  const AI = window.ArcadeAI;
  const booth = AI && AI.booth;
  if (!AI || !booth || !AI.speakers) return;
  const gameId = booth.game;
  if (gameId !== 'ageofwar' && gameId !== 'homeless') return;
  if (document.getElementById('arcade-ai-speakers')) return;

  const roster = {};
  AI.npcs(gameId).forEach(function (p) { roster[p.id] = p; });
  const spots = AI.speakers(gameId);
  const turns = {};
  let bubbleTimer = 0;

  const style = document.createElement('style');
  style.textContent = [
    '#arcade-ai-speakers{position:fixed;inset:0;pointer-events:none;z-index:48}',
    '.ai-speaker{position:fixed;pointer-events:auto;width:40px;height:40px;margin:0;padding:0;',
    'border-radius:50%;border:2px solid #f0c14a;background:rgba(12,10,8,.9);color:#f6f1e6;cursor:pointer;',
    'transform:translate(-50%,-100%);box-shadow:0 6px 16px rgba(0,0,0,.45)}',
    '.ai-speaker[hidden]{display:none}',
    '.ai-speaker-face{font-size:18px;line-height:36px;display:block}',
    '.ai-speaker-name{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:2px;',
    'font:600 10px/1.2 ui-monospace,Menlo,monospace;color:#f6f1e6;text-shadow:0 1px 2px #000;white-space:nowrap;pointer-events:none}',
    '.ai-speaker:focus-visible{outline:2px solid #f0c14a;outline-offset:2px}',
    '#arcade-ai-bubble{position:fixed;z-index:60;pointer-events:none;max-width:min(240px,70vw);',
    'background:rgba(10,12,16,.95);color:#f4efe6;border:1px solid #f0c14a;border-radius:12px;',
    'padding:8px 10px 9px;font:14px/1.35 Georgia,Palatino,serif;box-shadow:0 12px 28px rgba(0,0,0,.45);',
    'transform:translate(-50%,calc(-100% - 8px))}',
    '#arcade-ai-bubble[hidden]{display:none}',
    '#arcade-ai-bubble b{display:block;font:600 10px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.06em;',
    'text-transform:uppercase;color:#f0c14a;margin-bottom:3px}',
  ].join('');
  document.head.appendChild(style);

  const layer = document.createElement('div');
  layer.id = 'arcade-ai-speakers';
  document.body.appendChild(layer);

  const bubble = document.createElement('div');
  bubble.id = 'arcade-ai-bubble';
  bubble.hidden = true;
  bubble.setAttribute('role', 'status');
  document.body.appendChild(bubble);

  const buttons = {};
  spots.forEach(function (spot) {
    const person = roster[spot.id];
    if (!person) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-speaker';
    btn.dataset.npc = spot.id;
    btn.setAttribute('aria-label', 'Talk to ' + person.name + ', ' + person.role);
    btn.innerHTML = '<span class="ai-speaker-face"></span><span class="ai-speaker-name"></span>';
    btn.querySelector('.ai-speaker-face').textContent = person.icon;
    btn.querySelector('.ai-speaker-name').textContent = person.name;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      speak(spot.id, btn);
    });
    layer.appendChild(btn);
    buttons[spot.id] = btn;
  });

  let figuresAdded = false;
  function addFigures() {
    if (figuresAdded || gameId !== 'homeless') return;
    if (!window.THREE || !window.scene) return;
    const colors = { marisol: 0xc45a3a, ray: 0x3f6a44, dee: 0x3a5a8a };
    spots.forEach(function (spot) {
      const grp = new THREE.Group();
      grp.userData.arcadeSpeaker = spot.id;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.72, 0.28),
        new THREE.MeshLambertMaterial({ color: colors[spot.id] || 0x8a7050 })
      );
      body.position.y = 0.7;
      body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.28, 0.28),
        new THREE.MeshLambertMaterial({ color: 0xe8c4a0 })
      );
      head.position.y = 1.22;
      head.castShadow = true;
      grp.add(body);
      grp.add(head);
      grp.position.set(spot.x, 0, spot.z);
      scene.add(grp);
    });
    figuresAdded = true;
  }

  function placeBubble(btn) {
    const r = btn.getBoundingClientRect();
    let left = r.left + r.width / 2;
    let top = r.top - 6;
    const max = Math.min(240, window.innerWidth * 0.7);
    if (left < max / 2 + 8) left = max / 2 + 8;
    if (left > window.innerWidth - max / 2 - 8) left = window.innerWidth - max / 2 - 8;
    if (top < 72) top = r.bottom + 56;
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function showBubble(btn, result) {
    bubble.hidden = false;
    bubble.dataset.npc = btn.dataset.npc;
    bubble.innerHTML = '';
    const who = document.createElement('b');
    who.textContent = result.name + ' · ' + result.role;
    const line = document.createElement('div');
    line.textContent = result.line;
    bubble.appendChild(who);
    bubble.appendChild(line);
    placeBubble(btn);
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.hidden = true; }, 7000);
  }

  function speak(npcId, btn) {
    const turn = turns[npcId] || 0;
    turns[npcId] = turn + 1;
    booth.talk(npcId, turn).then(function (result) {
      if (!result) return;
      showBubble(btn, result);
    }).catch(function () {});
  }

  function coversControl(btn) {
    const r = btn.getBoundingClientRect();
    if (r.width < 2) return false;
    const nodes = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el === btn || btn.contains(el) || layer.contains(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return true;
    }
    return false;
  }

  function pin(btn, x, y, canvasWidth) {
    btn.hidden = false;
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
    const coarse = (gameId === 'ageofwar' || gameId === 'homeless') && window.matchMedia('(pointer: coarse)').matches;
    const floor = coarse ? 44 : 30;
    const cap = coarse ? 48 : 42;
    const size = Math.max(floor, Math.min(cap, canvasWidth / 22));
    btn.style.width = size + 'px';
    btn.style.height = size + 'px';
    const face = btn.querySelector('.ai-speaker-face');
    if (face) face.style.lineHeight = Math.max(0, size - 4) + 'px';
    if (coversControl(btn)) btn.hidden = true;
  }

  function bandOf(el) {
    if (!el || el.hidden) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return r;
  }

  function footprint(btn) {
    const r = btn.getBoundingClientRect();
    const name = btn.querySelector('.ai-speaker-name');
    const n = name ? name.getBoundingClientRect() : r;
    return {
      left: Math.min(r.left, n.left),
      right: Math.max(r.right, n.right),
      top: Math.min(r.top, n.top),
      bottom: Math.max(r.bottom, n.bottom),
    };
  }

  // The weather pill and the coach keep a band of the field. Name
  // tags move off that band. tabTop is the Units row: a hero may
  // step up the field, and may not step down onto those tabs.
  function clearBands(btn, bands, tabTop) {
    const box = btn.getBoundingClientRect();
    const nameEl = btn.querySelector('.ai-speaker-name');
    const nameBox = nameEl ? nameEl.getBoundingClientRect() : box;
    const foot = footprint(btn);
    const across = [];
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      if (!band) continue;
      if (foot.left < band.right && foot.right > band.left) {
        across.push({ top: band.top, bottom: band.bottom });
      }
    }
    const anchor = parseFloat(btn.style.top) || 0;
    const nameH = Math.max(0, nameBox.bottom - box.bottom);
    btn.style.top = seatSpeaker(anchor, box.height, nameH, across, tabTop) + 'px';
  }

  const project = window.THREE ? new THREE.Vector3() : null;

  function layout() {
    if (gameId === 'ageofwar') {
      const canvas = document.getElementById('aow-canvas');
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      spots.forEach(function (spot) {
        const btn = buttons[spot.id];
        if (!btn) return;
        if (r.width < 40) { btn.hidden = true; return; }
        pin(btn, r.left + (spot.x / 1280) * r.width, r.top + (spot.y / 560) * r.height, r.width);
        if (!btn.hidden) {
          const tabs = bandOf(document.querySelector('.aow-tabs'));
          clearBands(btn, [
            bandOf(document.getElementById('aow-sky')),
            bandOf(document.getElementById('aow-coach')),
          ], tabs ? tabs.top : null);
          if (coversControl(btn)) btn.hidden = true;
        }
      });
      return;
    }
    addFigures();
    const canvas = document.getElementById('three-canvas');
    if (!canvas || !window.camera || !project) return;
    const r = canvas.getBoundingClientRect();
    if (camera.updateMatrixWorld) camera.updateMatrixWorld();
    const chrome = ['action-panel', 'craft-panel', 'workers-panel', 'bottom-bar', 'top-bar', 'walk-pad', 'craft-toggle'].map(function (id) {
      return bandOf(document.getElementById(id));
    });
    spots.forEach(function (spot) {
      const btn = buttons[spot.id];
      if (!btn) return;
      project.set(spot.x, 1.45, spot.z);
      project.project(camera);
      if (project.z < -1 || project.z > 1) { btn.hidden = true; return; }
      const x = r.left + (project.x * 0.5 + 0.5) * r.width;
      const y = r.top + (-project.y * 0.5 + 0.5) * r.height;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) { btn.hidden = true; return; }
      pin(btn, x, y, r.width);
      if (btn.hidden) return;
      const box = btn.getBoundingClientRect();
      const size = box.width;
      const moved = nudgeSpeaker(box.left, box.top, size, chrome);
      const left = Math.max(r.left, Math.min(r.right - size, moved.x));
      const top = Math.max(r.top, Math.min(r.bottom - size, moved.y));
      /* The anchor is the bottom center. translate(-50%, -100%) hangs the button on it. */
      btn.style.left = (left + size / 2) + 'px';
      btn.style.top = (top + size) + 'px';
      if (coversControl(btn)) btn.hidden = true;
    });
  }

  function frame() {
    layout();
    if (!bubble.hidden) {
      const openId = bubble.dataset.npc;
      const openBtn = openId && buttons[openId];
      if (openBtn && !openBtn.hidden) placeBubble(openBtn);
    }
    requestAnimationFrame(frame);
  }

  addFigures();
  layout();
  requestAnimationFrame(frame);
})();
