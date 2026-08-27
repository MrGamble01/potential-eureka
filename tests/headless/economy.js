/* LAB-59 — where the money actually comes from, and what that costs.
 *
 * LAB-58 corrected Grow Op's upgrade copy, and in writing it up I said
 * Bigger Yield was "the strongest buy in the game". The DESCRIPTION bug
 * was real and is fixed — `bags = 1 + upgLv('yield1')` is +100% a level,
 * not the +20% the panel used to claim. But "strongest buy" was a value
 * judgement I never checked, and modelling the pipeline says it is close
 * to the opposite at the point where the player is offered it.
 *
 * Grow Op is a three-stage pipeline and income is set by its NARROWEST
 * stage, not by any one upgrade:
 *
 *   grow    plots / (18 / (1 + 0.3*lights))            buds per second
 *   trim    (1 + 0.25*trimmer) / 8                     batches per second
 *           each finished batch yields (1 + yield) bags
 *   sell    one buyer every 25 / (1 + 0.3*network) s,
 *           taking 1-2 bags (avg 1.5)                  bags per second
 *
 * In Act I — the garage, two plots, nothing bought — supply is already
 * about 1.85x demand. The stash fills whatever you do, so every upgrade
 * that makes MORE PRODUCT adds nothing to income until the sales side
 * catches up, and the three that raise price or buyer rate are the only
 * ones that pay:
 *
 *   Premium Product   +40%      Bigger Yield        +0%
 *   Distribution Net  +30%      Better Grow Lights  +0%
 *   Vac-Seal Bags     +15%      Electric Trimmer    +0%
 *
 * That is a real ordering — sales side first, supply side once demand
 * has been raised — and it may well be deliberate. What it is not is
 * VISIBLE: Bigger Yield sits in the Act I shop at $200, the cheapest
 * "more product" button on the panel, doing nothing for income until
 * Distribution Network is several levels up.
 *
 * This suite does not rebalance anything. It computes the figure so it
 * is known rather than latent in four functions, prints it on every run,
 * and pins the structural constants so the model cannot quietly drift
 * away from the game it claims to describe. Whether to change the
 * ordering is a design call for the owner, exactly like the 45-session
 * memory chain in QA-25.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const num = re => { const m = re.exec(src); return m ? parseFloat(m[1]) : NaN; };

// ---- constants, read from the game ------------------------------
const GROW      = num(/const GROW_TIME_BASE = (\d+);/);
const TRIM      = num(/const TRIM_TIME = (\d+);/);
const PRICE     = num(/function salePrice\(\) \{\s*const base = (\d+);/);
const ARRIVE    = num(/return (\d+) \/ \(1 \+ upgLv\('network'\)\*[\d.]+\)/);
const LIGHTS    = num(/GROW_TIME_BASE \/ \(1 \+ upgLv\('lights1'\) \* ([\d.]+)\)/);
const TRIMSTEP  = num(/1 \+ upgLv\('trim'\)\*([\d.]+)/);
const NETSTEP   = num(/\(1 \+ upgLv\('network'\)\*([\d.]+)\)/);
const BAGSSTEP  = num(/upgLv\('bags'\)\*([\d.]+)/);
const PRICESTEP = num(/upgLv\('price'\)\*([\d.]+)/);
const PLOTS     = (src.match(/^buildGrowPlot\([^)]*'garage'\);$/gm) || []).length;
const BUY_MIN   = num(/buyCount: whale \? WHALE_BAGS : (\d+) \+ Math\.floor\(Math\.random\(\)\*\d+\)/);
const BUY_SPAN  = num(/buyCount: whale \? WHALE_BAGS : \d+ \+ Math\.floor\(Math\.random\(\)\*(\d+)\)/);
const yieldAdd  = /let bags = 1 \+ upgLv\('yield1'\);/.test(src);

const all = { GROW, TRIM, PRICE, ARRIVE, LIGHTS, TRIMSTEP, NETSTEP, BAGSSTEP, PRICESTEP, PLOTS, BUY_MIN, BUY_SPAN };
ok(Object.values(all).every(Number.isFinite) && PLOTS > 0 && yieldAdd,
   `every constant was read out of the game (${Object.entries(all).map(([k, v]) => k + '=' + v).join(' ')})`);
ok(PLOTS === 2, `Act I starts with ${PLOTS} grow plots`);
ok(BUY_MIN === 1 && BUY_SPAN === 2, `an ordinary buyer takes ${BUY_MIN}-${BUY_MIN + BUY_SPAN - 1} bags`);

// ---- the pipeline -------------------------------------------------
const avgBuy = BUY_MIN + (BUY_SPAN - 1) / 2;
const supply = ({ L = 0, Y = 0, T = 0, plots = PLOTS } = {}) =>
  Math.min(plots / (GROW / (1 + LIGHTS * L)), (1 + TRIMSTEP * T) / TRIM) * (1 + Y);
const demand = ({ N = 0 } = {}) => avgBuy / (ARRIVE / (1 + NETSTEP * N));
const income = (o = {}) =>
  Math.min(supply(o), demand(o)) * PRICE * (1 + BAGSSTEP * (o.B || 0) + PRICESTEP * (o.P || 0));

const base = income();
const BUYS = [
  ['Better Grow Lights Lv1', { L: 1 }, 120],
  ['Bigger Yield Lv1',       { Y: 1 }, 200],
  ['Bigger Yield Lv4',       { Y: 4 }, 3000],
  ['Electric Trimmer Lv1',   { T: 1 }, 180],
  ['Vac-Seal Bags Lv1',      { B: 1 }, 250],
  ['Distribution Net Lv1',   { N: 1 }, 400],
  ['Premium Product Lv1',    { P: 1 }, 500],
];

console.log('\n  Act I — the garage, two plots, no crew');
console.log(`  supply ${supply().toFixed(3)} bags/s vs demand ${demand().toFixed(3)} bags/s ` +
            `— ${(supply() / demand()).toFixed(2)}x, so DEMAND is what caps income\n`);
console.log(`  ${'upgrade'.padEnd(24)}${'cost'.padStart(7)}${'$/sec'.padStart(9)}${'gain'.padStart(8)}`);
for (const [name, o, cost] of BUYS) {
  const inc = income(o);
  console.log(`  ${name.padEnd(24)}${('$' + cost).padStart(7)}${inc.toFixed(3).padStart(9)}` +
              `${((inc / base - 1) * 100).toFixed(0).padStart(7)}%`);
}
console.log('');

// ---- what the model asserts ---------------------------------------
ok(supply() > demand() * 1.5,
   `Act I supply outruns demand by ${(supply() / demand()).toFixed(2)}x before anything is bought`);

// Distinct upgrades, not table rows — Bigger Yield appears twice above.
const zero = [...new Set(BUYS.filter(([, o]) => Math.abs(income(o) - base) < 1e-9)
  .map(([n]) => n.replace(/ Lv\d+$/, '')))];
ok(zero.length === 3 && zero.every(n => /Yield|Lights|Trimmer/.test(n)),
   `exactly the three production upgrades add nothing to Act I income: ${zero.join(', ')}`);

ok(Math.abs(income({ P: 1 }) / base - (1 + PRICESTEP)) < 1e-9,
   `Premium Product is the best Act I buy (+${(PRICESTEP * 100).toFixed(0)}%)`);
ok(Math.abs(income({ N: 1 }) / base - (1 + NETSTEP)) < 1e-9,
   `Distribution Network is second (+${(NETSTEP * 100).toFixed(0)}%)`);

// The constraint does flip once the sales side is raised far enough —
// that is the ordering, and it is worth knowing where the corner is.
let flip = 0;
while (flip < 12 && demand({ N: flip }) < supply()) flip++;
ok(flip > 0 && flip <= 12,
   `production upgrades start paying at Distribution Network Lv${flip}, where demand finally overtakes supply`);

// Guard the guard: a model that agreed with everything would prove nothing.
ok(income({ Y: 1, N: 8 }) > income({ N: 8 }),
   'and past that corner Bigger Yield does pay — the model is not simply blind to it');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
