/* ============================================
   WORD FIVE — a Wordle-style word guesser
   6 guesses, on-screen + physical keyboard,
   correct duplicate-letter shading, win streak.
   ============================================ */

const WordFiveGame = (() => {
  const ROWS = 6, LEN = 5;

  // Curated answer pool — common, unambiguous five-letter words.
  const WORDS = (
    'about above actor adept adobe adult after again alarm album alert alike alive allow aloft alone along aloud amber amend among ample angel anger angle ankle apart apple apply april arena argue arise armor arrow ashen aside asset audio audit avoid awake award aware badge baker basic beach beard beast begin being belly bench berry birth black blade blame blank blast blaze bleak blend bless blind block bloom blown blues blunt board boast bonus boost booth bound brain brake brand brave bread break breed brick bride brief bring broad broke brook broom brown brush build built bunch burst cabin cable candy cargo carve catch cause chair chalk chant chaos charm chart chase cheap check cheek cheer chess chest chief child chill china chose civic civil claim clamp clash class clean clear clerk click cliff climb cling clock close cloth cloud clove clown coach coast could count court cover crack craft crane crash crawl crazy cream creek crest crime crisp cross crowd crown crumb crush curve cycle daily dairy dance dealt death debut decay delay dense depth diary dimly diner ditch dizzy dodge doing donor doubt dough dozen draft drain drama drank drawn dread dream dress dried drift drill drink drive drone drove drown dwell eager eagle early earth easel eaten eater ebony edict eerie eight elbow elder elect elite ember empty enact enemy enjoy enter entry equal erase error essay ethic event every exact exalt excel exile exist extra fable faced facet fairy faith false fancy fatal fault favor feast fence ferry fetch fever fewer fiber field fiery fifth fifty fight final first fixed flame flare flash flask fleet flesh float flock flood floor flour fluid flung flush flute focal focus foggy force forge forth forty forum found frame fraud fresh front frost fruit fully funny gauge geese ghost giant given giver glade gland glare glass gleam glide globe gloom glory glove going grace grade grain grand grant grape graph grasp grass grave graze great greed green greet grief grill grind groan groin groom gross group grove grown guard guess guest guide guild guilt habit hairy hardy harsh haste hatch haunt haven havoc heart heavy hedge hefty hello hence herbs hilly hinge hobby honey honor horde horse hotel hound house hover human humid humor hurry ideal image inbox index inept inert infer inlet inner input irate issue ivory jelly jewel joint joker jolly judge juice jumbo kayak kebab knack kneel knelt knife knock known label labor laden ladle lance lapse large laser latch later laugh layer leaky leant leapt learn lease least leave ledge legal lemon level lever light limbo linen liner lingo liver lobby local lodge lofty logic loose lorry loser lousy loyal lucid lucky lunar lunch lunge lupin leash lymph lyric macro madam major maker mango maple march marsh match mayor meant medal media melon mercy merge merit merry metal meter midst might mimic miner minor minus mixer model modem moist money month moose moral motor mound mount mourn mouse mouth mover movie muddy mummy mural music musty myrrh nadir naive nasal naval needy nerve never newer newly nicer niche niece night ninth noble noise north notch noted novel nurse nutty nylon oasis occur ocean offer often olive onion onset opera orbit organ other otter ought ounce outer overt owner ozone paddy panel panic pants paper party paste patch pause peace peach pearl pedal penny perch peril petal petty phase phone photo piano piece pilot pinch pitch pivot pixel pizza place plaid plain plane plank plant plate plaza plead pleat plait pluck plumb plume plump plush point poise poker polar polka porch posed pound power press price pride prime print prior prism prize probe prone proof props proud prove prowl proxy prune psalm pulse punch pupil puppy purge purse quack quail quake quart queen query quest queue quick quiet quill quilt quirk quite quota quote rabbi radar radio rally ranch range rapid ratio raven razor reach react ready realm rebel refer regal reign relax relay remit renal renew repay reply reset resin retro rhino rhyme rider ridge rifle right rigid rinse ripen risen risky rival river roast robot rocky rogue roman rough round route rover royal rugby ruler rumor rural rusty sadly sails saint salad salsa salty salve sandy sauce saucy sauna scald scale scalp scaly scamp scant scare scarf scary scene scent scoff scold scoop scope score scorn scour scout scowl scrap scrub scuba scurf seize sense serve seven sever shade shady shaft shake shaky shale shall shame shape share shark sharp shave shawl shear sheep sheer sheet shelf shell shine shiny shire shirt shoal shock shone shook shoot shore short shout shove shown shrub shrug siege sieve sight silky silly since sinew siren sixth sixty skate skiff skill skirt skull skunk slack slain slant slash slate sleek sleep sleet slept slice slick slide slime slimy sling slope sloth small smart smash smear smell smile smirk smith smoke smoky snack snail snake snare sneak snort snout snowy snuff soapy sober solar solid solve sonar sonic sorry sound south space spade spare spark spawn speak spear speck speed spell spend spent spice spicy spike spill spine spiny spire spite splat split spoil spoke spoof spool spoon sport spout spray spree sprig spurn squad squat squid stack staff stage staid stain stair stake stale stalk stall stamp stand stare stark start stash state stave stead steak steal steam steed steel steep steer stein stern stick stiff still stilt sting stint stock stoic stole stomp stone stony stood stool stoop store stork storm story stout stove strap straw stray strip strut stuck study stuff stump stung stunt suave sugar suite sulky sunny super surge sushi swamp swarm swear sweat sweep sweet swell swept swift swine swing swipe swirl sword swore sworn syrup table taboo taken taker tally talon tango taper tardy taste tasty taunt teach tease teddy teeth tempo tenor tense tenth tepid terse thank theft their theme there these thick thief thigh thing think third thong thorn those three threw throb throw thumb thump tibia tidal tiger tight tilde timer timid tipsy titan toast today token tonal tonic tooth topaz topic torch total totem touch tough towel tower toxic trace track trade trail train trait tramp trash tread treat trend trial tribe trick tried troth tripe troll troop trout trove truce truck truly trump trunk trust truth tulip tumor tunic turbo tutor twang tweak tweed tweet twice twine twirl twist tying udder ulcer ultra uncle under undue unfit unify union unite unity until upper upset urban usurp usage usher usual utter vague valet valid valor value valve vapor vault verve venom venue verge verse vicar video vigor villa vinyl viola viper viral virus visit vista vital vivid vocal vodka vogue voice voter vouch vowel wafer wager wagon waist waltz waste watch water waver weary weave wedge weigh weird whale wheat wheel where which while whine whirl whisk white whole whoop whose widow width wield wince winch windy wiser witch witty woken woman wordy world worry worse worst worth would wound woven wrath wreak wreck wrist write wrong wrote wrung yacht yearn yeast yield young yours youth yummy zebra zesty'
  ).split(/\s+/).filter(w => w.length === 5);

  let answer, guesses, current, row, state, gridEl, kbEl, msgEl;
  let streak = 0, bestStreak = 0;
  let keyState = {};   // letter -> 'correct' | 'present' | 'absent'
  let boundKey = null;

  function init() {
    gridEl = document.getElementById('word5-grid');
    kbEl = document.getElementById('word5-kb');
    msgEl = document.getElementById('word5-msg');
    if (!gridEl) return;
    bestStreak = Utils.highScore.load('word5-streak');
    buildKeyboard();
    boundKey = Utils.whenViewActive('view-word5', onKey);
    document.addEventListener('keydown', boundKey);
    newGame();
  }

  function pick() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

  function newGame() {
    answer = pick();
    guesses = [];
    current = '';
    row = 0;
    state = 'playing';
    keyState = {};
    buildGrid();
    buildKeyboard();
    updateHud();
    msg('');
  }

  function buildGrid() {
    gridEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'w5-row';
      for (let c = 0; c < LEN; c++) {
        const t = document.createElement('div');
        t.className = 'w5-tile';
        t.id = 'w5-' + r + '-' + c;
        rowEl.appendChild(t);
      }
      gridEl.appendChild(rowEl);
    }
  }

  const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  function buildKeyboard() {
    if (!kbEl) return;
    kbEl.innerHTML = '';
    KB_ROWS.forEach((line, i) => {
      const r = document.createElement('div');
      r.className = 'w5-kb-row';
      if (i === 2) r.appendChild(mkKey('Enter', 'enter', 'w5-key-wide'));
      for (const ch of line) r.appendChild(mkKey(ch.toUpperCase(), ch, '', keyState[ch]));
      if (i === 2) r.appendChild(mkKey('⌫', 'back', 'w5-key-wide'));
      kbEl.appendChild(r);
    });
  }
  function mkKey(label, key, extra, st) {
    const b = document.createElement('button');
    b.className = 'w5-key ' + (extra || '') + (st ? ' w5-' + st : '');
    b.textContent = label;
    b.addEventListener('click', () => handle(key));
    return b;
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Enter') { handle('enter'); e.preventDefault(); }
    else if (k === 'Backspace') { handle('back'); e.preventDefault(); }
    else if (/^[a-zA-Z]$/.test(k)) { handle(k.toLowerCase()); e.preventDefault(); }
    else if (k.toLowerCase() === 'n' && state !== 'playing') { newGame(); }
  }

  function handle(key) {
    if (state !== 'playing') {
      if (key === 'enter') newGame();
      return;
    }
    if (key === 'enter') return submit();
    if (key === 'back') { current = current.slice(0, -1); paintCurrent(); return; }
    if (/^[a-z]$/.test(key) && current.length < LEN) { current += key; paintCurrent(); Utils.sfx('move'); }
  }

  function paintCurrent() {
    for (let c = 0; c < LEN; c++) {
      const t = document.getElementById('w5-' + row + '-' + c);
      if (!t) continue;
      t.textContent = (current[c] || '').toUpperCase();
      t.classList.toggle('w5-filled', !!current[c]);
    }
  }

  function score(guess) {
    const res = Array(LEN).fill('absent');
    const pool = answer.split('');
    for (let i = 0; i < LEN; i++) if (guess[i] === pool[i]) { res[i] = 'correct'; pool[i] = null; }
    for (let i = 0; i < LEN; i++) {
      if (res[i] === 'correct') continue;
      const j = pool.indexOf(guess[i]);
      if (j >= 0) { res[i] = 'present'; pool[j] = null; }
    }
    return res;
  }

  function submit() {
    if (current.length < LEN) { shakeRow(); msg('Not enough letters'); return; }
    const res = score(current);
    // reveal with a little stagger
    for (let c = 0; c < LEN; c++) {
      const t = document.getElementById('w5-' + row + '-' + c);
      const st = res[c];
      setTimeout(() => {
        t.classList.add('w5-' + st, 'w5-reveal');
        Utils.sfx(st === 'correct' ? 'bonus' : 'move');
      }, c * 130);
      // upgrade keyboard state (correct > present > absent)
      const ch = current[c], prev = keyState[ch];
      if (st === 'correct' || (st === 'present' && prev !== 'correct') || (st === 'absent' && !prev)) keyState[ch] = st;
    }
    setTimeout(buildKeyboard, LEN * 130);

    guesses.push(current);
    const won = current === answer;
    const guessRow = row;
    current = ''; row++;

    if (won) {
      setTimeout(() => {
        state = 'won';
        streak++; bestStreak = Utils.highScore.save('word5-streak', streak, bestStreak);
        Utils.sfx('bonus');
        if (window.Effects) Effects.shakeCanvas(gridEl, 4, 200);
        msg(['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][guessRow] + ' Streak: ' + streak, 'good');
        updateHud();
      }, LEN * 130 + 60);
    } else if (row >= ROWS) {
      setTimeout(() => {
        state = 'lost';
        streak = 0;
        Utils.sfx('die');
        msg('The word was ' + answer.toUpperCase(), 'bad');
        updateHud();
      }, LEN * 130 + 60);
    }
  }

  function shakeRow() {
    const rEl = gridEl.children[row];
    if (!rEl) return;
    rEl.classList.remove('w5-shake');
    void rEl.offsetWidth;   // reflow to restart the animation
    rEl.classList.add('w5-shake');
  }

  function msg(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'w5-msg' + (kind ? ' w5-msg-' + kind : '');
  }

  function updateHud() {
    const s = document.getElementById('word5-streak'); if (s) s.textContent = streak;
    const b = document.getElementById('word5-best'); if (b) b.textContent = bestStreak;
  }

  function destroy() {
    if (boundKey) document.removeEventListener('keydown', boundKey);
  }

  return { init, newGame, destroy };
})();
