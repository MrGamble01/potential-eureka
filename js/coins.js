/* ============================================
   ARCADE COINS + COSMETICS (IDEA-SITE-5).
   Achievements mint coins (10 apiece, credited
   retroactively and exactly once per trophy);
   coins buy accent palettes — swaps of the
   --primary token family the whole hub is
   already built on. Palettes stack with the
   SITE-6 themes: the accent wins the primary
   tokens, the theme keeps everything else.
   ============================================ */

const Coins = (() => {
  const KEY = 'arcade-coins';
  const COIN_PER_ACH = 10;
  const PALETTES = [
    { id: 'indigo', name: 'Indigo',  cost: 0,  swatch: '#6C63FF' },
    { id: 'ember',  name: 'Ember',   cost: 30, swatch: '#F0883E' },
    { id: 'jade',   name: 'Jade',    cost: 30, swatch: '#3FB950' },
    { id: 'rose',   name: 'Rose',    cost: 30, swatch: '#F778BA' },
    { id: 'gold',   name: 'Gold',    cost: 60, swatch: '#F7C948' },
  ];

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        s.paid = s.paid || {};
        s.owned = s.owned || {};
        s.owned.indigo = true;
        s.equipped = s.equipped || 'indigo';
        s.balance = Math.max(0, s.balance | 0);
        return s;
      }
    } catch {}
    return { balance: 0, paid: {}, owned: { indigo: true }, equipped: 'indigo' };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

  // Mint coins for any achievement not yet paid out — idempotent, so
  // trophies earned before this feature shipped still pay.
  function credit() {
    if (typeof Achievements === 'undefined') return 0;
    const s = load();
    let minted = 0;
    for (const id of Object.keys(Achievements.unlocked())) {
      if (!s.paid[id]) { s.paid[id] = true; s.balance += COIN_PER_ACH; minted += COIN_PER_ACH; }
    }
    if (minted) {
      save(s);
      // toast() draws the 🪙 itself — the message must not carry a second one.
      toast(`+${minted} coins from achievements`);
    }
    return minted;
  }

  function apply(id, persistLess) {
    if (id && id !== 'indigo') document.documentElement.dataset.accent = id;
    else delete document.documentElement.dataset.accent;
  }

  function buy(id) {
    const s = load();
    const p = PALETTES.find(x => x.id === id);
    if (!p || s.owned[id]) return false;
    if (s.balance < p.cost) return false;
    s.balance -= p.cost;
    s.owned[id] = true;
    save(s);
    if (typeof SFX !== 'undefined' && SFX.play) SFX.play('bonus');
    return true;
  }

  function equip(id) {
    const s = load();
    if (!s.owned[id]) return false;
    s.equipped = id;
    save(s);
    apply(id);
    return true;
  }

  // The coin pill rides the achievement pill's styling, which means it also
  // rides its position: bottom-right, fixed, same corner. The two always
  // arrive together — switchView() runs Achievements.check() and then
  // Coins.credit() — so the pill announcing the coins landed squarely on top
  // of the trophy that minted them, and a player's first unlock was hidden by
  // its own reward. Sit above whatever is already down there instead.
  function stackAbove(el) {
    el.style.bottom = '';                                    // back to the stylesheet's slot
    let bottom = parseFloat(getComputedStyle(el).bottom) || 0;
    for (const other of document.querySelectorAll('.ach-toast')) {
      if (other === el) continue;
      // offsetHeight + the resolved `bottom`, not getBoundingClientRect():
      // a pill mid-entry-animation is still translated down, and measuring
      // that would park this one on the seam. Reading another stacked pill's
      // inline bottom is what lets a third one stack on both.
      const below = (parseFloat(getComputedStyle(other).bottom) || 0) + other.offsetHeight;
      if (other.offsetHeight) bottom = Math.max(bottom, below + 10);
    }
    el.style.bottom = bottom + 'px';
  }

  let toastT = null;
  function toast(msg) {
    let el = document.getElementById('coin-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'coin-toast';
      el.className = 'ach-toast';       // ride the achievement pill styling
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="ach-toast-icon">🪙</span><span>${msg}</span>`;
    el.classList.remove('ach-toast-out');
    stackAbove(el);
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.classList.add('ach-toast-out'); }, 2600);
  }

  function renderInto(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const s = load();
    el.innerHTML =
      `<div class="shop-head">🪙 COIN SHOP <span class="shop-balance">${s.balance} coins</span></div>` +
      `<div class="shop-sub">Achievements mint 10 coins each. Spend them on the arcade's accent color.</div>` +
      `<div class="shop-row">` +
      PALETTES.map(p => {
        const owned = !!s.owned[p.id];
        const equipped = s.equipped === p.id;
        const label = equipped ? 'EQUIPPED' : owned ? 'EQUIP' : `${p.cost} 🪙`;
        return `<button class="shop-chip${equipped ? ' equipped' : ''}" data-pal="${p.id}"` +
          `${!owned && s.balance < p.cost ? ' disabled' : ''}>` +
          `<span class="shop-swatch" style="background:${p.swatch}"></span>${p.name}` +
          `<span class="shop-tag">${label}</span></button>`;
      }).join('') +
      `</div>`;
    el.querySelectorAll('.shop-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pal;
        const st = load();
        if (!st.owned[pid]) {
          if (!buy(pid)) return;
          toast(`Unlocked the ${PALETTES.find(x => x.id === pid).name} accent`);
        }
        equip(pid);
        renderInto(id);
      });
    });
  }

  function init() {
    apply(load().equipped);
    credit();
  }

  return { init, credit, renderInto, buy, equip, load };
})();
