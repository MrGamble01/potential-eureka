/* ============================================
   WORD CASCADE — Wordtris on the Tetris loop.
   Single letter tiles fall; steer them into the
   stack. Any contiguous run that spells a word
   (3+ letters, left→right in rows or top→bottom
   in columns) clears, the columns collapse, and
   chains multiply the score. One column topping
   out ends the run.
   ============================================ */

const WordCascadeGame = (() => {
  const COLS = 8, ROWS = 10, CELL = 46, PAD = 10;
  const WIDTH = COLS * CELL + PAD * 2;
  const HEIGHT = ROWS * CELL + PAD * 2;

  // Compact common-word dictionary, 3-5 letters. Room-temperature
  // vocabulary on purpose: every clear should feel discoverable.
  const DICT = new Set((
    'ace act add age ago aid aim air ale all and ant any ape apt arc are arm art ash ask ate awe axe bad bag ban bar bat bay bed bee beg bet bid big bin bit boa bog boo bow box boy bud bug bun bus but buy cab can cap car cat cob cod cog cop cot cow cry cub cue cup cut dab dad dam day den dew did die dig dim din dip doe dog don dot dry dub dud due dug dye ear eat ebb eel egg ego elf elk elm end era erg eve ewe eye fad fan far fat fax fed fee few fig fin fir fit fix flu fly fob foe fog for fox fry fun fur gag gap gas gel gem get gig gin gnu got gum gun gut guy gym had hag ham has hat hay hem hen her hew hex hid him hip his hit hoe hog hop hot how hub hue hug hum hut ice icy ill imp ink inn ion ire irk its ivy jab jam jar jaw jay jet jig job jog jot joy jug jut keg key kid kin kit lab lad lag lap law lax lay leg let lid lie lip lit lob log lot low lug lye mad man map mat maw may men met mid mix mob mod mop mow mud mug nab nag nap net new nib nil nip nit nod nor not now nun nut oak oar oat odd ode off oft oil old one opt orb ore our out owe owl own pad pal pan par pat paw pay pea peg pen pet pew pie pig pin pit ply pod pop pot pro pry pub pug pun pup put rag ram ran rap rat raw ray red rib rid rig rim rip rob rod roe rot row rub rue rug rum run rut rye sad sag sap sat saw say sea set sew she shy sin sip sir sit six ski sky sly sob sod son sop sow soy spa spy sty sub sue sum sun tab tag tan tap tar tax tea ten the thy tie tin tip toe ton too top tot tow toy try tub tug tux two urn use van vat vet vex via vie vow wag war was wax way web wed wee wet who why wig win wit woe wok won woo wow yak yam yap yaw yes yet yew you zip zoo ' +
    'able ably ache acid acre aged ajar akin ally also alto amid ants apex arch area aria army atom aunt auto avid away axis baby back bail bait bake bald bale ball balm band bank bare bark barn base bash bask bass bath bead beak beam bean bear beat beef been beer bell belt bend bent best bike bill bind bird bite blip blob blot blue blur boar boat body boil bold bolt bomb bond bone book boom boot bore born boss both bout bowl brag bran brew brim brow buck buds bulb bulk bull bump bunk burn bury bush bust busy cafe cage cake calf call calm came camp cane cape card care carp cart case cash cast cave cell cent chap char chat chef chew chic chin chip chop cite city clad clam clan clap claw clay clip clog club clue coal coat code coil coin cold colt comb come cone cook cool cope copy cord core cork corn cost cosy cove cozy crab cram crew crib crop crow cube cubs cuff cult curb curd cure curl cusp cute dare dark darn dart dash data date dawn days daze dead deaf deal dean dear debt deck deed deem deep deer defy dent deny desk dial dice diet dime dine ding dirt disc dish dive dock dole doll dome done doom door dose dots dour dove down doze drab drag draw drew drip drop drum dual duck duct dude duel duet duke dull duly dumb dump dune dusk dust duty each earl earn ease east easy echo edge edit eels envy epic even ever evil exam exit face fact fade fail fair fake fall fame fang fare farm fast fate fawn fear feat feed feel fell felt fern feud file fill film find fine fire firm fish fist five flag flak flap flat flaw flea fled flee flew flex flip flow flue foal foam foil fold folk fond font food fool foot ford fore fork form fort foul four fowl free fret frog from fuel full fume fund funk fury fuse fuss gain gait gala gale gall game gang gape garb gash gasp gate gave gaze gear gene gift gild gill gilt girl gist give glad glee glen glow glue gnat goad goal goat goes gold golf gone gong good gore gown grab gray grew grey grid grim grin grip grit grow grub gulf gull gulp guru gush gust hail hair hale half hall halo halt hand hang hard hare harm harp hate haul have hawk haze head heal heap hear heat heed heel heir held helm help herb herd here hero hide high hike hill hilt hind hint hire hive hold hole holy home hone hood hoof hook hoop hope horn hose host hour howl huge hull hunt hurl hush husk hymn icon idea idle idly inch into iris iron itch item jade jail jazz jest jibe jilt join joke jolt jury just keel keen keep kelp kept kick kiln kilt kind king kiss kite knee knew knit knob knot know lace lack lady laid lair lake lamb lame lamp land lane last late lava lawn lazy lead leaf leak lean leap left lend lens lent less lest levy liar lice lick lied lien life lift like lily limb lime limp line link lint lion lisp list live load loaf loan lobe lock loft logo lone long look loom loop lord lore lose loss lost loud love luck lull lump lung lure lurk lush lute made mail maim main make male mall malt mane many mare mark mash mask mast mate math maze mead meal mean meat meek meet meld melt memo mend menu mere mesh mess mice mild mile milk mill mime mind mine mint mire miss mist mite moan moat mock mode mold mole molt monk mood moon moor moot more moss most moth move much muck mule mull muse mush must mute myth nail name nape navy near neat neck need neon nest news next nice nick nine node none noon norm nose note noun nova numb oath obey oboe odds odor ogle ogre oily okay omen omit once only onto onus onyx ooze opal open opus oral ouch ounce oust oval oven over pace pack pact page paid pail pain pair pale palm pane pang pant park part pass past path pave pawn peak pear peat peck peek peel peer pelt perk pest pier pike pile pill pine pink pint pipe pity plan play plea plod plot plow ploy plug plum plus poem poet poke pole poll pond pony pool poor pore pork port pose posh post pour pout pray prey prim prod prop prow pull pulp pump punk pure push quit quiz race rack raft rage raid rail rain rake ramp rang rank rant rare rash rate rave read real ream reap rear reed reef reel rein rely rend rent rest rice rich ride rife rift rind ring rink riot ripe rise risk rite road roam roar robe rock rode role roll roof rook room root rope rose rosy rout rude ruin rule rung runt ruse rush rust sack safe saga sage said sail sake sale salt same sand sane sang sank sash save scam scan scar seal seam sear seat sect seed seek seem seen seep self sell semi send sent sews shed shim shin ship shoe shop shot show shun shut sick side sift sigh sign silk sill silo sing sink sire site size skew skid skim skin skip slab slam slap sled slew slid slim slip slit slot slow slug slum slur smog smug snag snap snip snob snow snub soak soap soar sock soda sofa soft soil sold sole solo some song soon soot sore sort soul soup sour sown span spar spat spec sped spin spit spot spur stab stag star stay stem step stew stir stop stow stub stud stun such suds suit sulk sung sunk sure surf swab swam swan swap sway swim tack tact tail tale talk tall tame tank tape tart task teal team tear tell tend tent term test text than that thaw them then they thin this thud thus tick tide tidy tier tile till tilt time tint tiny tire toad toil told toll tomb tone tong took tool tore torn tort toss tour town trap tray tree trek trim trio trip trod true tuck tuft tuna tune turf turn tusk twig twin type ugly undo unit unto upon urge used user vain vane vase vast veal veer veil vein vent verb very vest veto vial vice view vine visa void volt vote wade waft wage wail wait wake walk wall wand wane want ward ware warm warn warp wart wary wash wasp wave wavy weak wear weed week weep weld well went wept were west what when whim whip whir wick wide wife wild will wilt wind wine wing wink wipe wire wise wish with wolf wood wool word wore work worm worn wove wrap wren yard yarn yawn year yell yoga yoke your zeal zero zest zinc zone zoom ' +
    'about above adult after again alarm alone amber angle apple arena badge beach board brain bread break brick bring brown build cabin candy chair charm chart chase check chess chest child claim class clean clear clock cloud coast count court cover craft crane crash cream crown dance depth diary dozen dream dress drink drive eagle early earth eight elbow ember empty enjoy enter entry equal event every exact fable faith fancy feast fence field fifty fight final first flame flash float flood floor flour focus force forge forty found frame fresh front frost fruit ghost giant glass globe glory glove grace grade grain grand grant grape graph grass great green greet group guard guess guest guide habit heart heavy hedge honey honor horse hotel house human humor ideal image index inner input issue jelly jewel joint judge juice knife knock label large laser latch laugh layer learn lease least leave ledge legal lemon level light limit linen liver lobby local lodge logic loose loyal lucky lunar lunch magic major maker mango maple march match mayor medal media melon mercy merge merit merry metal meter might minor mixer model money month moral motor mound mount mouse mouth movie music never night noble noise north notch noted novel nurse ocean offer often olive onion opera orbit organ other otter ounce outer owner paper party paste patch pause peace peach pearl pedal penny perch petal phase phone photo piano piece pilot pinch pitch pivot pixel pizza place plain plane plank plant plate plaza point polar porch pound power press price pride prime print prize proof proud prove pulse punch pupil purse queen quest quick quiet quilt quote radar radio rally ranch range rapid ratio reach react ready realm rebel refer reign relax relay reply reset rider ridge rifle right rinse risen rival river roast robot rocky rogue rough round route royal ruler rural saint salad salsa salty sauce scale scene scent scoop scope score scout seize sense serve seven shade shaft shake shame shape share shark sharp shave sheep sheet shelf shell shine shiny shirt shock shore short shout shown siege sight silky silly since siren sixty skate skill skirt skull slate sleep slice slide slope small smart smell smile smoke snack snail snake sneak solar solid solve sonic sound south space spade spare spark speak spear speed spell spend spice spike spill spine spoke spoon sport spout spray spree squad stack staff stage stair stake stale stalk stall stamp stand stare start state steak steal steam steel steep steer stern stick stiff still sting stock stone stood stool store stork storm story stout stove strap straw strip stuck study stuff stump sugar suite sunny super surge sweet swift swing sword table taken tally tango taste teach tease tempo tenor tense tenth theme there thick thing think third thorn three throw thumb tiger tight timer toast today token tonic tooth topic torch total touch tough towel tower toxic trace track trade trail train trait treat trend trial tribe trick troop trout truce truck trunk trust truth tulip tutor twice twist under union unite unity until upper urban usage usher usual value vapor vault venue verse video vigor villa vinyl viola visit vital vivid vocal voice vowel wafer wager wagon waist waltz waste watch water weary weave wedge weigh whale wheat wheel where which while white whole width witch woman world worry worth would wound woven wrist write wrong yacht yeast yield young youth zebra'
  ).split(/\s+/).filter(Boolean));

  // Scrabble-ish letter values + a frequency-weighted draw bag.
  const VALS = { a:1,b:3,c:3,d:2,e:1,f:4,g:2,h:4,i:1,j:8,k:5,l:1,m:3,n:1,o:1,p:3,q:10,r:1,s:1,t:1,u:1,v:4,w:4,x:8,y:4,z:10 };
  const BAG = 'eeeeeeeeeeaaaaaaaaiiiiiiiioooooonnnnnnrrrrrrttttttllllssssuuuuddddgggbbccmmppffhhvvwwyykjxqz';

  let canvas, ctx, loop;
  let grid, cur, score, wordsCleared, best, running, over;
  let dropT, dropEvery, flashCells, flashT, lastWords, chainPeak;
  const sfx = Utils.sfx;

  const randLetter = () => BAG[Math.floor(Math.random() * BAG.length)];

  function init() {
    canvas = document.getElementById('wc-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    best = Utils.highScore.load('cascade-best');
    reset(false);
    updateInfo();

    document.addEventListener('keydown', Utils.whenViewActive('view-wordcascade', e => {
      if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.key)) e.preventDefault();
      if (!running || over) {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start();
        return;
      }
      if (!cur) return;
      if (e.key === 'ArrowLeft' && canBe(cur.col - 1, cur.row)) cur.col--;
      else if (e.key === 'ArrowRight' && canBe(cur.col + 1, cur.row)) cur.col++;
      else if (e.key === 'ArrowDown') dropT = dropEvery;   // soft drop: force a step
      else if (e.key === ' ' && !e.repeat) { while (canBe(cur.col, cur.row + 1)) cur.row++; lock(); }
      draw();
    }));
    canvas.addEventListener('pointerdown', e => {
      if (!running || over) { start(); return; }
      if (!cur) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * WIDTH;
      const col = Math.floor((x - PAD) / CELL);
      if (col < cur.col && canBe(cur.col - 1, cur.row)) cur.col--;
      else if (col > cur.col && canBe(cur.col + 1, cur.row)) cur.col++;
      else dropT = dropEvery;
      draw();
    });
    const ov = document.getElementById('wc-overlay');
    if (ov) ov.addEventListener('click', () => { if (!running || over) start(); });

    loop = Utils.gameLoop(tick);
    draw();
  }

  function reset(run) {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    cur = null;
    score = 0;
    wordsCleared = 0;
    chainPeak = 0;
    dropEvery = 48;      // frames per gravity step (Utils.gameLoop 60ths)
    dropT = 0;
    flashCells = [];
    flashT = 0;
    lastWords = [];
    over = false;
    running = !!run;
  }

  function start() {
    reset(true);
    sfx('start');
    const ov = document.getElementById('wc-overlay');
    if (ov) ov.style.display = 'none';
    spawn();
    updateInfo();
    loop.start();
  }

  function spawn() {
    cur = { col: Math.floor(COLS / 2), row: 0, letter: randLetter() };
    if (grid[0][cur.col]) { endGame(); return; }
  }

  const canBe = (c, r) => c >= 0 && c < COLS && r < ROWS && r >= 0 && !grid[r][c];

  function tick(dt) {
    if (!running || over) return;
    if (flashT > 0) {
      flashT -= dt;
      if (flashT <= 0) resolveFlash();
      draw();
      return;
    }
    if (!cur) return;
    dropT += dt;
    if (dropT >= dropEvery) {
      dropT = 0;
      if (canBe(cur.col, cur.row + 1)) cur.row++;
      else lock();
    }
    draw();
  }

  function lock() {
    grid[cur.row][cur.col] = cur.letter;
    cur = null;
    sfx('lock');
    scanAndClear(1);
  }

  // Find the single best dictionary word on the board (longest, then
  // highest value): contiguous filled runs read L→R and T→B.
  function findWord() {
    let found = null;
    const consider = (cells) => {
      const word = cells.map(c => grid[c.r][c.c]).join('');
      if (!DICT.has(word)) return;
      const val = cells.reduce((t, c) => t + (VALS[grid[c.r][c.c]] || 1), 0);
      if (!found || word.length > found.word.length ||
          (word.length === found.word.length && val > found.val)) {
        found = { cells, word, val };
      }
    };
    const scanLine = (line) => {
      // line = array of {r,c} for one row or column, in reading order.
      let run = [];
      const flushRun = () => {
        for (let len = run.length; len >= 3; len--) {
          for (let s = 0; s + len <= run.length; s++) consider(run.slice(s, s + len));
        }
        run = [];
      };
      for (const cell of line) {
        if (grid[cell.r][cell.c]) run.push(cell);
        else flushRun();
      }
      flushRun();
    };
    for (let r = 0; r < ROWS; r++) scanLine(Array.from({ length: COLS }, (_, c) => ({ r, c })));
    for (let c = 0; c < COLS; c++) scanLine(Array.from({ length: ROWS }, (_, r) => ({ r, c })));
    return found;
  }

  function scanAndClear(chain) {
    const hit = findWord();
    if (!hit) {
      if (!over) spawn();
      updateInfo();
      return;
    }
    // Score: letter values × word length × chain.
    const pts = hit.val * hit.word.length * chain;
    score += pts;
    wordsCleared++;
    chainPeak = Math.max(chainPeak, chain);
    lastWords.unshift({ word: hit.word.toUpperCase(), pts, chain });
    lastWords = lastWords.slice(0, 4);
    flashCells = hit.cells.slice();
    flashT = 22;
    flashCells.chain = chain;
    if (typeof SFX !== 'undefined' && SFX.note) SFX.note(440 + chain * 120, 0.14);
    // Speed up a touch every few words.
    dropEvery = Math.max(18, 48 - Math.floor(wordsCleared / 6) * 4);
    updateInfo();
  }

  function resolveFlash() {
    for (const c of flashCells) grid[c.r][c.c] = null;
    // Gravity: letters fall within their columns.
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c]) {
          if (write !== r) { grid[write][c] = grid[r][c]; grid[r][c] = null; }
          write--;
        }
      }
    }
    const chain = (flashCells.chain || 1) + 1;
    flashCells = [];
    scanAndClear(chain);
  }

  function endGame() {
    over = true;
    running = false;
    loop.stop();
    sfx('over');
    Effects.shakeCanvas(canvas, 8, 300);
    best = Utils.highScore.save('cascade-best', score, best);
    updateInfo();
    draw();
    Utils.showGameOver('wc-overlay', {
      lines: [`Score: ${score.toLocaleString()} &nbsp;·&nbsp; Words: ${wordsCleared}`,
              `Best chain: ×${Math.max(1, chainPeak)} &nbsp;·&nbsp; Best: ${best.toLocaleString()}`],
      hint: 'Press SPACE or tap to play again',
    });
  }

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('wc-score', score.toLocaleString());
    set('wc-words', wordsCleared);
    set('wc-best', best.toLocaleString());
    const lw = document.getElementById('wc-lastwords');
    if (lw) lw.innerHTML = lastWords.map(w =>
      `<span>${w.word} <em>+${w.pts}${w.chain > 1 ? ' ×' + w.chain : ''}</em></span>`).join(' ');
  }

  function drawTile(c, r, letter, ghost, flash) {
    const x = PAD + c * CELL, y = PAD + r * CELL;
    ctx.fillStyle = flash ? '#F7C948' : ghost ? 'rgba(108,99,255,0.35)' : '#21262d';
    ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = flash ? '#fff' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = flash ? 2 : 1;
    ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5);
    ctx.fillStyle = flash ? '#0d1117' : '#E6EDF3';
    ctx.font = '800 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(letter.toUpperCase(), x + CELL / 2, y + CELL / 2 + 8);
    ctx.font = '600 9px Inter, sans-serif';
    ctx.fillStyle = flash ? '#0d1117' : '#7D8590';
    ctx.fillText(String(VALS[letter] || 1), x + CELL - 10, y + CELL - 8);
    ctx.textAlign = 'left';
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(PAD + c * CELL, PAD); ctx.lineTo(PAD + c * CELL, HEIGHT - PAD); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(PAD, PAD + r * CELL); ctx.lineTo(WIDTH - PAD, PAD + r * CELL); ctx.stroke();
    }

    const flashSet = new Set(flashCells.map(c => c.r + ',' + c.c));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) drawTile(c, r, grid[r][c], false, flashSet.has(r + ',' + c));
      }
    }
    if (cur) drawTile(cur.col, cur.row, cur.letter, false, false);

    if (!running && !over) {
      ctx.fillStyle = 'rgba(13,17,23,0.72)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '19px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE or tap to start', WIDTH / 2, HEIGHT / 2 - 12);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('Steer letters — spell words (3+) across or down to clear', WIDTH / 2, HEIGHT / 2 + 14);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    if (loop) loop.stop();
    running = false; over = false;
    const ov = document.getElementById('wc-overlay'); if (ov) ov.style.display = 'none';
    reset(false);
    draw();
  }

  return { init, start, destroy };
})();
