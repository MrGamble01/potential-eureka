/* LAB-58 — the numbers on things you buy.
 *
 * Two of the six flagships put figures in purchase copy. This suite
 * checks both against the code that implements them.
 *
 * Grow Op sells nine upgrades. Each carries a `desc` the player reads
 * before parting with in-game money. Three did not say what the code
 * did, and a fourth effect was not mentioned at all.
 *
 *   Bigger Yield    "+20% product per harvest per level", while
 *                   `bags = 1 + upgLv('yield1')` adds a WHOLE BAG per
 *                   level — Lv1 is +100%, not +20%: a 5x understatement.
 *                   Read next to Premium Product's honest "+40% for
 *                   $500", the strongest buy in the game was advertised
 *                   as the weakest. That is not a typo; that is a player
 *                   making a purchase on bad information.
 *   Lookout System  "20% slower per level", while
 *                   `max(1, 6 - lv*1.5)` is 25% of base per level.
 *   Clean Operation "25% faster per level", while `+ lv*0.5` is a FLAT
 *                   half-point of drain a second — not a percentage at
 *                   all, and on a bare operation Lv1 is +167%.
 *   Grow Lights     said nothing about `playerSpeed()`, which it also
 *                   raises 5% a level.
 *
 * The copy was corrected to the code, not the other way round: the code
 * is the balance this game has actually been played on, and nerfing
 * Bigger Yield 5x to match a wrong sentence would break every save in
 * exchange for nothing.
 *
 * Static, because it has to be. Grow Op's game script is
 * `<script type="module">`, so `UPG`, `salePrice()` and the rest are
 * module-scoped and unreachable from page.evaluate — and the one way to
 * reach them would be to bolt on a `window.__` hook, which is precisely
 * what tests/headless/nohooks.js exists to forbid (a leaked one shipped
 * for four rounds). Reading the source is the honest instrument, and for
 * this question it is also the better one: "does the sentence match the
 * coefficient" is a source-level question, and needs no browser.
 *
 * Each rule below pins a `desc` to the exact expression that implements
 * it. Change an effect without changing its sentence and this fails by
 * name.
 *
 * Voxel Isle makes five numeric promises of its own and — checked the
 * same way — gets all five right: 1.4 and +6 for the Barn, 1.2 for the
 * Farmhouse, 0.15 and 60s for the Compost Heap, 1.25 for the Weather
 * Vane, DOVE_PREMIUM = 1.75 and a 90s window for the Dovecote. Nothing
 * to fix there; the assertions exist to keep it that way. The other four
 * flagships state no percentages in purchase copy at all, so Grow Op was
 * the outlier rather than the tip of something.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// ---- the table ---------------------------------------------------
const block = /const UPG = \[([\s\S]*?)\n\];/.exec(src);
const rows = block ? [...block[1].matchAll(/\{id:'([a-z_0-9]+)',[\s\S]*?desc:'((?:[^'\\]|\\.)*)'\}/g)]
  .map(m => ({ id: m[1], desc: m[2].replace(/\\u2014/g, '—') })) : [];
const desc = id => (rows.find(r => r.id === id) || {}).desc || '';

// ---- pull each coefficient out of the function that applies it ----
const coef = (re, label) => {
  const m = re.exec(src);
  return m ? parseFloat(m[1]) : NaN;
};
const growth   = coef(/GROW_TIME_BASE \/ \(1 \+ upgLv\('lights1'\) \* ([\d.]+)\)/);
const moveSpd  = coef(/PLAYER_SPEED_BASE \* \(1 \+ upgLv\('lights1'\)\*([\d.]+)\)/);
const yieldAdd = /let bags = 1 \+ upgLv\('yield1'\);/.test(src);
const trimSpd  = coef(/1 \+ upgLv\('trim'\)\*([\d.]+)/);
const bagsPct  = coef(/upgLv\('bags'\)\*([\d.]+)/);
const pricePct = coef(/upgLv\('price'\)\*([\d.]+)/);
const netPct   = coef(/\(1 \+ upgLv\('network'\)\*([\d.]+)\)/);
const lookBase = coef(/Math\.max\(1, (\d+) - upgLv\('lookout_sys'\)\*[\d.]+\)/);
const lookStep = coef(/Math\.max\(1, \d+ - upgLv\('lookout_sys'\)\*([\d.]+)\)/);
const cleanAdd = coef(/upgLv\('cleanup'\)\*([\d.]+)/);

// ---- guard the guard ---------------------------------------------
ok(rows.length === 9, `the upgrade table parsed from source (${rows.length} rows)`);
ok([growth, moveSpd, trimSpd, bagsPct, pricePct, netPct, lookBase, lookStep, cleanAdd]
     .every(n => Number.isFinite(n)) && yieldAdd,
   'every effect expression was located in the source — a silent no-match would pass everything below');

// ---- the promises -------------------------------------------------
const pct = n => Math.round(n * 100);

ok(pct(growth) === 30 && new RegExp(`${pct(growth)}% faster per level`).test(desc('lights1')),
   `Grow Lights: code grows ${pct(growth)}% faster per level, and says so`);
ok(pct(moveSpd) === 5 && new RegExp(`move ${pct(moveSpd)}% quicker`).test(desc('lights1')),
   `Grow Lights: it also moves you ${pct(moveSpd)}% quicker — no longer undocumented`);

ok(yieldAdd && /\+1 bag per trimmed batch per level/.test(desc('yield1')),
   'Bigger Yield: code adds +1 bag per level, and the copy says +1 bag per level');
ok(!/\+20%/.test(desc('yield1')) && /doubles/.test(desc('yield1')),
   'Bigger Yield: the 5x understatement is gone, and Lv1 is named as a doubling');

ok(pct(trimSpd) === 25 && new RegExp(`Trim ${pct(trimSpd)}% faster per level`).test(desc('trim')),
   `Electric Trimmer: ${pct(trimSpd)}% per level, stated correctly`);
ok(pct(bagsPct) === 15 && new RegExp(`\\+${pct(bagsPct)}% sale price per level`).test(desc('bags')),
   `Vac-Seal Bags: +${pct(bagsPct)}% sale price per level, stated correctly`);
ok(pct(pricePct) === 40 && new RegExp(`\\+${pct(pricePct)}% sale price per level`).test(desc('price')),
   `Premium Product: +${pct(pricePct)}% sale price per level, stated correctly`);
ok(pct(netPct) === 30 && new RegExp(`${pct(netPct)}% faster per level`).test(desc('network')),
   `Distribution Network: ${pct(netPct)}% per level, stated correctly`);

// Lookout is a linear cut off a fixed base, so "per level" is a share of
// that base — the figure the old copy got wrong.
const lookPerLv = pct(lookStep / lookBase);
const lookMax = pct((lookStep * 3) / lookBase);
ok(lookPerLv === 25 && new RegExp(`${lookPerLv}% cooler per level`).test(desc('lookout_sys')),
   `Lookout System: ${lookStep}/${lookBase} is ${lookPerLv}% of base per level (the copy used to say 20%)`);
ok(lookMax === 75 && new RegExp(`${lookMax}% at Lv3`).test(desc('lookout_sys')),
   `Lookout System: and ${lookMax}% at Lv3, which the copy now states`);

ok(cleanAdd === 0.5 && new RegExp(`\\+${cleanAdd} heat cleared per second per level`).test(desc('cleanup')),
   `Clean Operation: a flat +${cleanAdd}/sec per level, described as a flat rate`);
ok(!/%/.test(desc('cleanup')),
   'Clean Operation: no percentage in the copy, because the effect is not one');

// ---- Voxel Isle: five promises, all of them already true ----------
// Kept here rather than in a suite of its own because the question is
// the same one: does the number on the thing you buy match the code?
const vox = fs.readFileSync(path.join(ROOT, 'voxel-garden.html'), 'utf8');
const vdesc = key => {
  const m = new RegExp(`${key}:\\s*\\{[^}]*?desc:'((?:[^'\\\\]|\\\\.)*)'`).exec(vox);
  return m ? m[1] : '';
};
const vcoef = re => { const m = re.exec(vox); return m ? parseFloat(m[1]) : NaN; };

const barnCap  = vcoef(/function animalCap\(\)\{return 14\+\(state\.buildings&&state\.buildings\.barn\?(\d+):0\)/);
const barnGrow = vcoef(/function animalGrowMult\(\)\{return state\.buildings&&state\.buildings\.barn\?([\d.]+):1;?\}/);
const farmRate = vcoef(/state\.buildings\.farmhouse\)rate\*=([\d.]+)/);
const compost  = vcoef(/p\.prog\+=def\.grow\*([\d.]+)/);
const compCool = vcoef(/boosted\+\+;\s*\}\s*compostT=(\d+);/);
const vaneMult = vcoef(/rainLeft=\(22\+Math\.random\(\)\*20\)\*\(vaneBuilt\(\)\?([\d.]+):1\)/);
const dovePrem = vcoef(/const DOVE_PREMIUM = ([\d.]+), DOVE_WINDOW = \d+;/);
const doveWin  = vcoef(/const DOVE_PREMIUM = [\d.]+, DOVE_WINDOW = (\d+);/);

ok([barnCap, barnGrow, farmRate, compost, compCool, vaneMult, dovePrem, doveWin].every(n => Number.isFinite(n)),
   'Voxel Isle: every effect expression was located — guards the guard');

ok(barnCap === 6 && barnGrow === 1.4
   && new RegExp(`\\+${barnCap} animals`).test(vdesc('barn'))
   && new RegExp(`\\+${pct(barnGrow - 1)}% growth`).test(vdesc('barn')),
   `Voxel Barn: +${barnCap} animals and ${barnGrow}x growth, both stated correctly`);
ok(new RegExp(`\\+${pct(farmRate - 1)}% crop growth`).test(vdesc('farmhouse')),
   `Voxel Farmhouse: ${farmRate}x crop growth = +${pct(farmRate - 1)}%, stated correctly`);
ok(new RegExp(`surges \\+${pct(compost)}%`).test(vdesc('compost'))
   && new RegExp(`\\(${compCool}s cooldown\\)`).test(vdesc('compost')),
   `Voxel Compost Heap: +${pct(compost)}% of the grow bar on a ${compCool}s cooldown, both stated correctly`);
ok(new RegExp(`linger ${pct(vaneMult - 1)}% longer`).test(vdesc('vane')),
   `Voxel Weather Vane: showers ${vaneMult}x = ${pct(vaneMult - 1)}% longer, stated correctly`);
ok(new RegExp(`${pct(dovePrem - 1)}% premium`).test(vdesc('dovecote')) && doveWin === 90,
   `Voxel Dovecote: DOVE_PREMIUM ${dovePrem} = a ${pct(dovePrem - 1)}% premium, stated correctly (${doveWin}s window)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
