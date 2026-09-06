/* HV-98 — Dena said 25 goodwill saved, then counted the wallet.
 *
 * Paperwork, Hope tells the player to "put some goodwill aside" and
 * the log names the gate: "25 goodwill saved and morale above 60."
 * checkArc() then reads the live purse: G.goodwill>=25 && G.morale>60.
 *
 * That is not saving. A camp that already has 30 when the forms land
 * can back a street light (20) the same afternoon and drop to 10.
 * Next dawn Dena treats the aside as gone. The filing never happened.
 *
 * Distinct from HV-80 / #743 (stage 0 still waits on a camp that
 * holds together) and from HV-61 / hvarc (Keys comes back after a
 * reload). This ticket is the stage-2 purse vs the word "saved".
 *
 * Write-first. Hook-free. ui.js is not this ticket.
 *
 *  A. Source: paperwork still sells "saved"; the stage-2 gate reads
 *     a latch, not only the current wallet. G defaults the stamp;
 *     loadGame migrates a missing one.
 *  B. Live: 28 on hand and morale 70 still opens Keys (the wallet
 *     path is not removed).
 *  C. Named: paperwork at 30, spend the street-light 20, morale 70
 *     — Keys still opens. Revert the latch and this line goes red.
 *  D. Never reached 25: stay at stage 2.
 *  E. Morale still has to clear 60 after the aside is stamped.
 *  F. Stage 0 is not skipped by a fat wallet.
 *  G. The stamp survives a reload; an old stage-2 save sitting on
 *     25+ is treated as already filed.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const paperAt = loop.indexOf("id:'arc_paperwork'");
const paper = paperAt >= 0 ? loop.slice(paperAt, paperAt + 700) : '';
const arcAt = loop.indexOf('function checkArc(){');
const arc = arcAt >= 0 ? loop.slice(arcAt, arcAt + 900) : '';

ok(paperAt >= 0 && /id:'arc_paperwork'/.test(paper),
  'Paperwork, Hope is still the stage-2 card — guards the guard');
ok(/put some goodwill aside/.test(paper) && /25 goodwill saved/.test(paper),
  'the card and the log still say the 25 was saved, not held');
ok(/arcGoodwillSaved/.test(arc) && /morale\s*>\s*60/.test(arc),
  'HV-98: checkArc() files the aside as a latch and still wants morale above 60');
ok(/arcGoodwillSaved:\s*false/.test(cfg),
  'G defaults arcGoodwillSaved to false on a fresh camp');
ok(/typeof parsed\.arcGoodwillSaved!=='boolean'/.test(save)
  && /arcStage>=2 && G\.goodwill>=25/.test(save),
  'loadGame migrates a pre-HV-98 save that never wrote the stamp');
ok(!/arcGoodwillSaved/.test(ui),
  'ui.js is not this ticket — it still only paints Keys in Hand');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);

  // --- B + C + D + E + F + reload ------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => {
      localStorage.setItem('hv-intro-seen', '1');
      if (!sessionStorage.getItem('hvdenasaved-init')) {
        sessionStorage.setItem('hvdenasaved-init', '1');
        localStorage.removeItem('homeless_village_v1');
      }
    });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    const wallet = await page.evaluate(() => {
      G.arcStage = 2;
      G.arcDone = false;
      G.goodwill = 28;
      G.morale = 70;
      G.days = 18;
      G.health = 80;
      G.goalIndex = 9999;
      G.lastEventDay = 9999;
      checkArc();
      return {
        stage: G.arcStage,
        modal: !!document.getElementById('hv-graduation'),
      };
    });
    ok(wallet.stage === 3 && wallet.modal,
      'B. 28 on hand and morale 70 still opens Keys — the wallet path stays');

    const spent = await page.evaluate(() => {
      if (document.getElementById('hv-graduation')) {
        G.arcDone = true;
        document.getElementById('hv-graduation').remove();
      }
      G.arcStage = 1;
      G.arcDone = false;
      G.arcGoodwillSaved = false;
      G.structures.soup_kitchen = true;
      G.population = 4;
      G.goodwill = 30;
      G.morale = 40;
      G.rep = 80;
      G.petitions = {};
      G.days = 18;
      G.health = 80;
      G.goalIndex = 9999;
      G.lastEventDay = 9999;
      G.dog = 1;
      G.dogMetDay = 999;
      checkArc();
      const afterPaper = { stage: G.arcStage, gw: G.goodwill, morale: G.morale };
      doPetition('streetlight');
      const afterSpend = { gw: G.goodwill, petition: !!G.petitions.streetlight, stage: G.arcStage };
      G.morale = 70;
      checkArc();
      return {
        afterPaper: afterPaper,
        afterSpend: afterSpend,
        stage: G.arcStage,
        gw: G.goodwill,
        modal: !!document.getElementById('hv-graduation'),
      };
    });
    ok(spent.afterPaper.stage === 2,
      `paperwork still lands at stage 2 first (${spent.afterPaper.stage})`);
    ok(spent.afterSpend.petition && spent.afterSpend.gw === 10 && spent.afterSpend.stage === 2,
      `the street light spends the purse to 10 and does not skip the gate (${spent.afterSpend.gw}, stage ${spent.afterSpend.stage})`);
    ok(spent.stage === 3 && spent.modal,
      'HV-98: 25 goodwill saved still counts after the street light spends the wallet');

    const never = await page.evaluate(() => {
      if (document.getElementById('hv-graduation')) {
        G.arcDone = true;
        document.getElementById('hv-graduation').remove();
      }
      G.arcStage = 1;
      G.arcDone = false;
      G.arcGoodwillSaved = false;
      G.structures.soup_kitchen = true;
      G.population = 4;
      G.goodwill = 20;
      G.morale = 70;
      G.days = 18;
      checkArc();
      const mid = G.arcStage;
      checkArc();
      return { mid: mid, stage: G.arcStage, modal: !!document.getElementById('hv-graduation') };
    });
    ok(never.mid === 2 && never.stage === 2 && !never.modal,
      `D. twenty on hand was never saved — stay at paperwork (${never.stage})`);

    const morale = await page.evaluate(() => {
      G.arcStage = 1;
      G.arcDone = false;
      G.arcGoodwillSaved = false;
      G.structures.soup_kitchen = true;
      G.population = 4;
      G.goodwill = 30;
      G.morale = 40;
      G.rep = 80;
      G.petitions = {};
      checkArc();
      doPetition('streetlight');
      G.morale = 50;
      checkArc();
      const low = { stage: G.arcStage, modal: !!document.getElementById('hv-graduation') };
      G.morale = 70;
      checkArc();
      return {
        low: low,
        stage: G.arcStage,
        modal: !!document.getElementById('hv-graduation'),
      };
    });
    ok(morale.low.stage === 2 && !morale.low.modal,
      `E. a stamped aside still waits on morale above 60 (${morale.low.stage})`);
    ok(morale.stage === 3 && morale.modal,
      'E. morale 70 after the aside opens Keys');

    const early = await page.evaluate(() => {
      if (document.getElementById('hv-graduation')) {
        G.arcDone = true;
        document.getElementById('hv-graduation').remove();
      }
      G.arcStage = 0;
      G.arcDone = false;
      G.arcGoodwillSaved = false;
      G.goodwill = 40;
      G.morale = 70;
      G.days = 5;
      checkArc();
      return { stage: G.arcStage, modal: !!document.getElementById('hv-graduation') };
    });
    ok(early.stage === 0 && !early.modal,
      `F. a fat wallet on day 5 does not skip Dena's first visit (${early.stage})`);

    // G — stamp must ride the save. Paperwork at 30, reload, then spend.
    await page.evaluate(() => {
      if (document.getElementById('hv-graduation')) {
        G.arcDone = true;
        document.getElementById('hv-graduation').remove();
      }
      G.arcStage = 1;
      G.arcDone = false;
      G.arcGoodwillSaved = false;
      G.structures.soup_kitchen = true;
      G.population = 4;
      G.goodwill = 30;
      G.morale = 40;
      G.rep = 80;
      G.petitions = {};
      G.days = 18;
      G.health = 80;
      checkArc();
      saveGame();
    });
    await page.reload({ waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);
    const reloaded = await page.evaluate(() => {
      const before = { stage: G.arcStage, gw: G.goodwill, saved: !!G.arcGoodwillSaved };
      G.rep = 80;
      G.petitions = {};
      doPetition('streetlight');
      G.morale = 70;
      G.arcDone = false;
      checkArc();
      return {
        before: before,
        gw: G.goodwill,
        stage: G.arcStage,
        modal: !!document.getElementById('hv-graduation'),
      };
    });
    ok(reloaded.before.stage === 2 && reloaded.before.saved && reloaded.gw === 10
      && reloaded.stage === 3 && reloaded.modal,
      'G. the aside survives a reload, then the street light, then still opens Keys');

    ok(errs.length === 0, `live path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // --- old save, no stamp in the blob --------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => {
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.setItem('homeless_village_v1', JSON.stringify({
        arcStage: 2,
        arcDone: false,
        days: 18,
        goodwill: 30,
        morale: 70,
        health: 80,
        population: 4,
        structures: { soup_kitchen: true },
        fridgeSeeded: true,
        goalIndex: 9999,
        lastEventDay: 9999,
      }));
    });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);
    const migrated = await page.evaluate(() => {
      const stamped = !!G.arcGoodwillSaved;
      G.rep = 80;
      G.petitions = {};
      G.arcDone = false;
      if (document.getElementById('hv-graduation')) {
        document.getElementById('hv-graduation').remove();
        G.arcStage = 2;
        G.arcDone = false;
      }
      doPetition('streetlight');
      G.morale = 70;
      checkArc();
      return {
        stamped: stamped,
        gw: G.goodwill,
        stage: G.arcStage,
        modal: !!document.getElementById('hv-graduation'),
      };
    });
    ok(migrated.stamped && migrated.gw === 10 && migrated.stage === 3 && migrated.modal,
      'G. an old stage-2 save sitting on 30 is already filed, even after a spend');

    ok(errs.length === 0, `seeded path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
