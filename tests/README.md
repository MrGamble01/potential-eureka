# Headless QA

Every feature in this repo ships with behavioral verification: a
Playwright + headless-Chromium script that drives the real page —
clicks, key presses, seeded saves, exact payout math — and exits
non-zero on any failure. This directory holds the **re-runnable**
battery; run it before and after any change.

## Running

```bash
# 1. deps (once): node + a global playwright with Chromium
npm i -g playwright
npx playwright install chromium   # or point PLAYWRIGHT_BROWSERS_PATH at an existing install

# 2. serve the repo root
python3 -m http.server 8099 --bind 127.0.0.1

# 3. run the battery
./tests/headless/run.sh
```

`BASE` (default `http://127.0.0.1:8099`) and `NODE_PATH` (default
`npm root -g`) can be overridden. Individual suites run standalone:
`node tests/headless/daily.js`.

## What's covered

| Area | Suites |
|---|---|
| Whole site | `audit` (loads every page + hub view, fails on console/page errors beyond the environment baseline), `pwa` (service worker, offline shell), `meta20` (hero/meta copy) |
| Hub meta-layer | `daily` (7-game shared-seed challenge), `rivals` + `rivalsaow` + `rivalsflag` (share codes incl. all six flagship records), `ach`/`ach2` (achievements + completionist), `coins`, `insights`, `search`, `resume`, `theme`, `focus`, `shortcuts`, `patchnotes`, `backup` (whole-arcade backup/restore), `hofcard` (PNG score card), `hubhome` (Age of War billboard, Long/Quick scan, empty filter, hop-after-search, 900×700 density, scan-mark reset, 720×700 compact flagship, filter-mode chrome, 390 first-visit fold, Games-back restore, shell on HoF, daylight chrome, 1280 Long 3-across, description search, 1280 Studio one-card / Quick 3-across, HoF+resume restore, Studio hop, 390 shell under wrapped nav, HoF Long/Quick + sixth flagship, Hearthvale badge/reset, daylight HoF tokens, 390 HoF score wrap, HoF opens at the title after a scrolled catalogue, HoF per-lane ranks, daylight Patch Notes / Primer / overlay / PEAK / Studio Crew chips) |
| Age of War records | `aowrecords` (AOW-60: a malformed `aow-best-run` no longer freezes future bests; valid bests stay byte-for-byte. Drives the production writer through `vm`, no hook. Non-vacuous: the old `waves > (prev.waves \|\| 0)` comparison is replayed and writes nothing on the freeze payloads), `aowsession` (return chrome leftovers: a kept war holds the field / queue / wager / specials, New war drops it, pause/game-over/welcome/settings/awards/The Line carry Back to Games, 768 and 1024 tuck the topbar rail, 390 scrolls the leftover action bar, resume names wager/chest/council, game-over CTAs sit above the vault, 768×700 field taller than the leftover 200px cap, council carries Games, keyboard activation of resume/New war/Games plus unfocused resume shortcuts) |
| Hearthvale | `hvalechrome` (return chrome leftovers: shared Games pill, Begin building + hub exit, resume chip names the kept valley, 768×700 tucks the speed rail and drops the goal, Achievements/Chronicle/Decrees/Hall carry Games, corrupt-valley chip, pause is Resume the valley + Games, resume-chip New town, 390 kept resume leaves Games/gear tappable, trader/event carry Games, resume names caravan/stake/order/advance/wolves, pause names the holds, beforeunload flushes a kept town, Escape closes trader and The Hall, Tab/Shift+Tab reach welcome/pause Games without changing builds and Enter exits to the hub) |
| Hub games | `undo2048`, `w5share`, `cycles3` |
| Cross-game storage | `storagekeys` (every game reads back the localStorage keys it writes; no key claimed by two games on the shared origin) |
| Cross-game geometry | `reach` (UI-1/UI-2: every flagship control stays on screen at desktop, laptop, short-laptop and phone viewports) |
| Purchase copy | `promises` (the numbers on things you buy match the code that implements them — Grow Op's nine upgrades and Voxel Isle's five building effects; found three wrong descriptions in Grow Op, one understated 5×) |
| Shared hub storage | `hubstore` (the hub root and the Hall of Fame both boot with a corrupt shared key — rivals, coins, stats, achievements; 6 of its 8 payloads are valid JSON, because the parse is not where this bug class lives) |
| Cross-game save integrity | `saves` (every flagship boots from a deliberately damaged save — 7 malformed shapes plus hostile numbers in real fields; found three boot crashes where a saved number was used as an array index unchecked. Each row also asserts the game actually *read* the key, so a drifted key list fails loudly instead of passing clean) |
| Homeless Village | 128 suites — one per line under [Homeless Village suites](#homeless-village-suites) |

| Voxel Isle | 49 suites — one per line under [Voxel Isle suites](#voxel-isle-suites) |
Suites that need a temporary `window.__*` test hook in a game file
(the hook is added for the test and stripped before commit) are
**one-shot by design** and are not in this battery — their results are
recorded in the merge commits that shipped each feature.

### Homeless Village suites

*One line per suite, deliberately: these used to be a single table
row, so two PRs adding a suite on the same day conflicted on it even
when they touched different cards. Append yours; git merges the rest.*

- `hvweather`
- `hvdog` (Biscuit)
- `hvregulars`
- `hvoddjobs`
- `hvrep` (Word on the Street)
- `hvsoup` (Soup Night)
- `hvmural` (the Underpass Mural)
- `hvstash` (the Hidden Stash)
- `hvfire` (The Fire Held)
- `hvmeeting` (the Camp Meeting)
- `hvpetition` (City Petitions)
- `hvticket` (the Bus Ticket)
- `hvsnap` (the Cold Snap)
- `hvbusk` (the Busker's Guitar)
- `hvdeposit` (the Cart & the Deposit Run)
- `hvdepositlive` (hook-free: Deposit Run live count, shortfall, progress, and daily lock at desktop/tablet widths)
- `hvnewcomer` (the Newcomer)
- `hvpantry` (the Little Free Pantry)
- `hvcoats` (the Coat Rack)
- `hvtoolbox` (the Tool Box)
- `hvcompost` (the Compost Bin)
- `hvawning` (the Awning)
- `hvbarrel` (the Rain Barrel)
- `hvrainbet` (the Rain Bet)
- `hvgarage` (Marisol's Garage)
- `hvborrow` (the Borrowed Favor)
- `hvfridge` (the Corner Fridge)
- `hvrecord` (the Long Memory)
- `hvnote` (the Note in the Fridge Door)
- `hvwall` (the Writing on the Wall)
- `hvthermos` (the Old Thermos)
- `hvboard` (the Bulletin Board)
- `hvpotluck` (the Potluck)
- `hvstar` (the Chalk Star)
- `hvshelf` (the Community Shelf)
- `hvmarisol` (Marisol Drops By)
- `hvmugs` (the Spare Mugs)
- `hvreunion` (the Bridge Reunion)
- `hvsnapshot` (the Reunion Snapshot)
- `hvanniv` (the Bridge Anniversary)
- `hvnotebook` (the Spiral Notebook)
- `hvbench` (the Bench under the Bridge)
- `hvstory` (the Fire Story)
- `hvballad` (the Bridge Ballad)
- `hvcan` (the Coffee Can)
- `hvpanel` (the Fifth Panel)
- `hvwalk` (the Walk Down)
- `hvmark` (a Name on the Wall)
- `hvintro` (HV-56: the first-run crash course, a drift guard for its numbers, and visible Games exits from the course and The Bridge with real navigation at desktop/phone widths)
- `hvwander` (HV-60: the wander step is `speed * (dt/16.667)` so residents shuffle at their own `speed` and settle on a target instead of sprinting to it and ping-ponging across it — at 60fps and at the 100ms lag clamp)
- `hvbridge` (HV-59: The Bridge pauses the day clock — daylight, warmth and dawn hold while the overlay is open)
- `hvesc` (HV-58: Escape closes The Bridge)
- `hvlock` (HV-63: Dumpsters Locked said "today" and actually lasted a minute)
- `hvrefuse` (HV-61: Trade / Rain Bet / Garage / Fridge refuse a short purse before the timer, so a miss no longer charges the cooldown)
- `hvclock` (HV-62: a hostile timeOfDay cannot burn days on load)
- `hvfriend` (HV-65: Old Friend's morale surge fades at dawn — a reload no longer keeps the good feeling forever)
- `hvgradesc` (HV-66: Escape dismisses Keys in Hand the Keep Building way)
- `hvarc` (HV-61: Keys in Hand comes back after a reload)
- `hvmeetcap` (HV-64: a camp meeting of six pays +12 morale, not a silent cap of +10)
- `hvsky` (HV-67: Good Weather actually clears the sky)
- `hvrelight` (HV-69: Firewood relights the barrel after Fire Went Out)
- `hvfive` (HV-70: Found $5 pays five goodwill)
- `hvcoldyard` (HV-189: a cold sky halves the scrapyard haul)
- `hvbeds` (HV-190: the Community Garden harvests before the empty-larder bite)
- `hvwettamale` (HV-191: rain soaks Marisol's fence-post tamales)
- `hvballadfire` (HV-192: Play the Bridge Ballad said the hat by the fire, then a dead barrel still filled it)
- `hvsnapbeds` (HV-193: a named snap freezes the garden beds)
- `hvbag` (HV-194: Kind Stranger's bag near the bridge soaks in the rain)
- `hvraincandle` (HV-195: rain drowns the anniversary candle)
- `hveasy` (HV-196: Good Weather pays the beds when it clears a frost morning)
- `hvmurallight` (HV-197: no morning light on a rainy mural)
- `hvforagerain` (HV-198: Forage Area said cardboard and wood, then a rainy day still paid a dry-day haul)
- `hvstargroceries` (HV-199: a snap keeps star groceries off the fence)
- `hvkeep` (HV-200: Biscuit keep warmth lands before the fire held)
- `hvbarrelsweep` (HV-201: City Sweep confiscates the stored rainfall, not just scraps and food)
- `hvwetleaf` (HV-202: rain on an unroofed spiral notebook soaks the leaf-through)
- `hvsnapbox` (HV-203: a cold snap freezes the overnight leftover in the pantry box)
- `hvsnapbare` (HV-204: Look at the Snapshot refuses a bare fridge door before the timer)
- `hvsnapdrum` (HV-205: a cold snap freezes stored rainfall in the drum)
- `hvnotedoor` (HV-206: a fridge-less corner does not find a fridge-door note)
- `hvannivbare` (HV-207: Mark the Anniversary refuses an uncounted year before the timer)
- `hvfifthmural` (HV-208: Stand at the Fifth Panel waits for the four finished panels)
- `hvcookbowl` (HV-208: the Cook leaves Biscuit’s daily bowl)
- `hvwallname` (HV-210: Read the Wall cites the names Add a Name put up)
- `hvwetcasserole` (HV-211: Wave Marisol Down does not leave a dry casserole in the rain)
- `hvout` (HV-212: Fire Went Out does not land after the same dawn said the fire held)
- `hvsickrest` (HV-213: Illness Spreading said everyone feels terrible, then Rest still recovered a healthy sleep)
- `hvdig` (HV-214: Dig Up the Coffee Can refuses an empty piling before the timer)
- `hvwetsnap` (HV-215: Look at the Snapshot does not send a visitor through the rain)
- `hvwetcan` (HV-216: Dig Up the Coffee Can does not pay a dry dish from an open hole in the rain)
- `hvrail` (HV-217: City Sweep said confiscate supplies, then left the coats hanging on the rail)
- `hvgentre` (HV-218: Gentrification said harassment from locals is increasing, then Word on the Street never faded)
- `hvsnapscav` (HV-219: a named snap thins the dumpsters the same way it thins the corner)
- `hvthrow` (HV-220: Throw the Reunion ran a job when the whole story wasn't standing)
- `hvdown` (HV-221: Walk a Newcomer Down ran a job when nobody walks the wall yet)
- `hvleafbare` (HV-222: Leaf the Notebook ran a job when no notebook sat by the fridge)
- `hvroof` (HV-223: Roof the Dry Corner ran a 6s job when the camp came up short of sheeting)
- `hvballadbare` (HV-224: Play the Bridge Ballad ran a job when no tune was set)
- `hvbenchbare` (HV-225: Sit on the Bench ran a job when no bench stood by the fridge)
- `hvmarkbare` (HV-226: Add a Name ran a job when nobody new had been shown the wall)
- `hvpanelbare` (HV-227: Stand at the Fifth Panel ran a job when the fifth panel was still bare block)
- `hvgrant` (HV-228: Community Grant said civic, then the same-day sweep confiscated the delivery)
- `hvthermosfire` (HV-229: Pass the Thermos said it goes around the fire, then a dead barrel still poured)
- `hvgtrsweep` (HV-233: City Sweep said confiscate supplies, then left the scrap guitar on the corner)
- `hvgentbusk` (HV-234: Gentrification said harassment is increasing, then Busk still paid the quiet-corner take)
- `hvannivfire` (HV-235: Mark the Anniversary said light a candle, then a dead barrel still filled the pot)
- `hvtrust` (HV-236: Theft said trust no one, then Word never faded)
- `hvthermoused` (HV-237: Pass the Thermos ran a job when it already made its round)
- `hvyard` (HV-237: Sort at the scrapyard said dirty work, then a rainy day still paid a dry-day haul)
- `hvreunionheld` (HV-238: Throw the Reunion ran a job when it already went off today)
- `hvscrappersnap` (HV-239: the Scrapper said auto-scavenges every day, then a named snap still paid a quiet-day haul)
- `hvbug` (HV-240: Illness Spreading said a bug is going through the camp, then the Cook still prepared meals)
- `hvbarreltheft` (HV-241: Theft said they raided your stash, then left the stored rainfall)
- `hvnotebookleaf` (HV-242: Leaf the Notebook ran a job when it already got its leaf-through today)
- `hvheatcart` (HV-243: Deposit run said haul every can, then a heat-wave day still paid a cool-day take)
- `hvbenchsat` (HV-244: Sit on the Bench ran a job when it already got its sit today)
- `hvhalf` (HV-245: Word on the Street said Respected halves the complaint calls, then sweeps still came two-thirds as often)
- `hvmarisolcame` (HV-278: Wave Marisol Down ran a job when she already came by today)
- `hvkind` (HV-279: Hand out flyers said the owner is kind, then Word never heard the shop)
- `hvforagesnap` (HV-280: Forage Area said cardboard and wood, then a named snap still paid a quiet-day haul)
- `hvsnaplooked` (HV-230: Look at the Snapshot ran a job when it already got its look today)
- `hvlift` (HV-231: Unload at the depot said honest lifting, then Word never heard the day)
- `hvraincart` (HV-232: Deposit run said haul every can, then a rainy day still paid a dry-day take)
- `hvyardheat` (HV-246: Sort at the scrapyard said dirty work, then a heat-wave day still paid a cool-day haul)
- `hvdepotheat` (HV-247: Unload at the depot said honest lifting, then a heat-wave day still paid a cool-day lift)
- `hvband` (HV-248: Theft takes the weather band)
- `hvstorytold` (HV-249: Tell the Fire Story ran a job when it already got its telling tonight)
- `hvdry` (HV-53: the Dry Corner — the first link under the bridge that asks for something back: the build debits 12 scraps + 8 cardboard exactly, then the same button becomes the sitting)
- `hvhook` (HV-54: the Empty Hook — the third sit hangs it and the season's BASE warmth drain comes down 2, without touching the weather's bite or the snap's extra, which are the coat rack's job)
- `hvflyerheat` (HV-250: Hand out flyers said a local shop pays, then a heat-wave day still paid a cool-day take — the walk is outdoor work in the same scorcher the depot and the yard already feel)
- `hvricher` (HV-250: Rain said richer dumpster yield, then a wet day emptied a dry-day bin — rain's 1.25 fattens the haul and no longer raises the empty-bin roll with it)
- `hvballadplayed` (HV-251: Play the Bridge Ballad ran a job when it already got its playing tonight — the refusal moves ahead of the 2s job and the 30s lock, beside the HV-192 dead-barrel guard)
- `hvlotheat` (HV-252: Weed the community lot said the garden co-op shares the harvest, then a heat-wave day still paid a cool-day take)
- `hvbitter` (HV-252: the Coat Rack said bitter dawns cut half as deep, then the Cold Snap card still took the full warmth hit)
- `hvcandug` (HV-253: Dig Up the Coffee Can ran a job when it already got its dig today — the refusal moves ahead of the 2s job and the 30s lock, beside the HV-212 empty-piling guard)
- `hvkit` (HV-254: City Sweep said confiscate supplies, then left the tool box on the bench)
- `hvwetluck` (HV-255: the Potluck said folding tables by the fridge, then a rainy opening still paid a dry-day dish)
- `hvwetgrant` (HV-256: Community Grant said a crate delivered to the corner, then a rainy delivery still paid a dry-day load (renamed from the PR's hvgrant, which is HV-225's suite name in main))
- `hvtear` (HV-257: Tent said a roof of sorts, then a rainy dawn still tore it at the dry-day rate)
- `hvharass` (HV-258: Gentrification said harassment from locals is increasing, then Trade still paid the quiet-corner swap)
- `hvwetbox` (HV-259: the Free Pantry said someone left a little something overnight, then a rainy dawn still filled the box)
- `hvchill` (HV-260: a cold morning said the cold gets into everything, then Rest still recovered a warm-bed sleep)
- `hvedge` (HV-261: Someone new stands at the edge of the firelight, then a rainy dawn still brought them to wait)
- `hvtalk` (HV-262: around the fire someone talked about a sister two towns over, then a rainy dawn still opened the ask)
- `hvscorch` (HV-263: Hold a Camp Meeting said gather around the fire, then a scorcher still hosted the circle)
- `hvhotpot` (HV-264: Soup night said everyone ate hot, then a scorcher still fired the pot at full value)
- `hvskyheld` (HV-265: The fire held all night, then a scorcher still gave the barrel the credit)
- `hvchase` (HV-266: Theft said Biscuit chased them off, then he had curled up hungry)
- `hvwag` (HV-267: Walk the neighbor's dogs said fresh air, then a cold snap still paid the quiet-day walk)
- `hvhotwall` (HV-268: Paint the mural said one session on the underpass wall, then a scorcher still laid the panel)
- `hvhotwoods` (HV-269: Forage Area said cardboard and wood, then a scorcher still paid a cool-day haul)
- `hvsickpan` (HV-273: Illness Spreading said everyone feels terrible, then Panhandle still paid a well-day take)
- `hvfiverain` (HV-276: Found $5 said a crumpled bill on the sidewalk, then a rainy day still paid a dry-day five)
- `labintro` (LAB-62: Grow Op's crash course — the sixth flagship finally explains itself, and every number the panel quotes (heat per unit, the 95 raid line, the 100 bust line, the demand band, the stash cap) is recomputed from the source so the copy cannot rot)
- `primer` (SITE-4: the hub's START HERE primer — a first-time visitor is greeted once, a player with history never is, ? stays the shortcuts sheet, and every claim it makes is checked against something that really exists on the page)
- `sessiontag` (SITE-5: the session tag on every game card — the six flagships read Hours and the fifteen arcade games Few minutes, the studio claims neither, the tag leads its row, and the hub's existing filter picks it up for free (hours → 6, few minutes → 15))
- `hubhome` (homepage leftover polish: Age of War is the only hero CTA, Snake is a text hop, Long/Quick/Studio scan with counts, search still splits the catalogues, PLAY lines up, 900×700 is three-across, clearing search drops the scan mark, 720×700 keeps the compact flagship, filter mode tucks daily chrome, 390 first-visit Long games start on the fold, HoF/resume Games-back restores the catalogue, 1280 Studio stays one card, 1280 Quick is 3-across)
- `objective` (SITE-6: every arcade game states its goal and not just its keys — Crate Escape's stated goal is the one checkSolved tests, Vector Defense's wave and life counts are recomputed from the source, and a vocabulary guard catches any game that lists controls and never says what a run is for)
- `controls` (SITE-7: every arcade game names an input and not just a goal — the seven subtitles that stated a goal and left the keys unsaid now carry them, each claim recomputed from the handler that owns it, plus a guard against a subtitle rendering a literal HTML entity)

### Hearthvale suites

- `hvalechrome` (return chrome leftovers: shared Games pill, Begin building + hub exit, resume chip names the kept valley, 768×700 tucks the speed rail and drops the goal, Achievements/Chronicle/Decrees/Hall carry Games, corrupt-valley chip, pause is Resume the valley + Games, resume-chip New town, 390 kept resume leaves Games/gear tappable, trader/event carry Games, resume names caravan/stake/order/advance/wolves, pause names the holds, beforeunload flushes a kept town, Escape closes trader and The Hall)

### Voxel Isle suites

- `voxcrow` (crows & scarecrow)
- `voxangler` (Angler's Log)
- `voxcompost`
- `voxflotsam` (flotsam & the Pier)
- `voxstardust` (stardust wishes)
- `voxcat` (cat gifts)
- `voxrainbow` (Rainbow's End)
- `voxduck` (the Duck's Dabble)
- `voxlight` (the Lighthouse)
- `voxobs` (the Observatory)
- `voxballoon` (Balloon Tours)
- `voxdove` (the Dovecote)
- `voxwinter` (the Winter Market)
- `voxice` (the Ice Hut & ice fishing)
- `voxferry` (the Ferry Landing)
- `voxsugar` (the Sugar Shack)
- `voxmuseum` (the Isle Museum)
- `voxowl` (the Owl Roost)
- `voxpig` (the Truffle Pig)
- `voxcrib` (the Corn Crib)
- `voxjam` (the Preserve Shed)
- `voxcloud` (the Cloud Wager)
- `voxpolicy` (the Assessor's Policy)
- `voxnote` (the Trader's Note)
- `voxlantern` (the Stone Lantern)
- `voxbell` (the Harvest Bell)
- `voxbottle` (the Message in a Bottle)
- `voxtablet` (the Tide Tablet)
- `voxchrome` (return chrome leftovers: shared Games pill, Let's grow + hub exit, resume chip, 768×700 quest/tool split, Achievements/Almanac/Shore Games, corrupt-garden chip, New isle, tray above the hotbar, plant sheet tucks the tray, resume-chip New isle, 390 kept resume leaves town/awards/Games tappable, Escape closes The Shore)
- `voxconch` (the Keeper's Conch)
- `voxwick` (the Second Wick)
- `voxfest` (the Lantern Festival)
- `voxwreath` (the Shell Wreath)
- `voxbeacon` (the Beacon Flame)
- `voxkeeper` (the Old Keeper Rows Past)
- `voxoar` (the Spare Oar)
- `voxreunion` (the Shore Reunion)
- `voxframe` (the Driftwood Frame)
- `voxmooring` (the First Mooring)
- `voxhlog` (the Harbor Log)
- `voxbench` (the Harbor Bench)
- `voxyarn` (the Harbor Yarn)
- `voxshanty` (the Sea Shanty)
- `voxchest` (the Sunken Chest)
- `voxmural` (the Harbor Mural)
- `voxpilot` (the Pilot’s Walk)
- `voxmark` (Their Own Knot)
- `voxshed` (VOX-48: the Long Shed — three knots offer it, the build debits exactly 350🪙, and the sitting that replaces the chip pays once a session)
- `voxline` (VOX-49: the Bare Line — the third sitting hangs it and every hand quickens, adding to the Tavern's step rather than replacing it)


## Last full run

2026-08-25 (QA-14, post-Round-Twenty-Nine) — **all 83 suites green
end-to-end**, zero stale assertions, with the audit row holding its
12/32 environment baseline. One flake on the first pass: the
`daily` suite's free-play-vs-daily maze-layout control tripped
under battery load (three slow free-play loads read back the same
lattice); the suite ran 13/13 green standalone immediately after,
and the full 83-suite battery was re-run end-to-end green — no code
fault, nothing changed. First battery carrying the two promoted second-story
suites (`hvboard`, `voxwick`) and the first run after the heirloom
round (Depths 199–204) and the second-story round (Depths 206–211)
landed whole — the six new cross-run keys (`tyc-ring`,
`growop-lighter`, `aow-standard`, `hv-thermos`, `hvale-hearth`,
`vox-conch`) proved fully isolated from the run saves the other
suites wipe at will, and the tier-2 thresholds (the second chair,
the gym annex, the officers' mess, the bulletin board, the rope
swing, the second wick) held their gates under the battery's
fresh-profile loads. The Tycoon, Grow Op, Age of War and Hearthvale
legs were verified by their own one-shot suites at merge time, as
always.

2026-08-25 (QA-13, post-Round-Twenty-Seven) — **all 79 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted almanac-round
suites (`hvwall`, `voxtablet`) and the first run after the letters
round (Depths 185–190) and the almanac round (Depths 192–197)
landed whole — the six new cross-run history keys (`tyc-history`,
`growop-history`, `aow-annals`, `hv-history`, `hvale-history`,
`vox-history`) proved fully isolated from the run saves the other
suites wipe at will, and both promoted suites held their tallies
under the battery's fresh-profile loads. The Tycoon, Grow Op,
Age of War and Hearthvale legs were verified by their own one-shot
suites at merge time, as always.

2026-08-25 (QA-12, post-Round-Twenty-Five) — **all 75 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the four promoted legacy- and
record-round suites (`hvfridge`, `voxlantern`, `hvrecord`,
`voxbell`) and the first run after the legacy round (Depths
171–176) and the record round (Depths 178–183) landed whole — the
new cross-run keys (`hv-fridge`, `hv-record`, `vox-lantern`,
`vox-record`) proved fully isolated from the run saves the other
suites wipe at will, and the VOX-27 `DOMContentLoaded` boot-paint
fix held for both isle chips under the battery's fresh-profile
loads. The Tycoon, Grow Op, Age of War and Hearthvale legs were
verified by their own one-shot suites at merge time, as always.

2026-08-25 (QA-11, post-Round-Twenty-Three) — **all 71 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted Round-23
suites (`hvborrow`, `voxnote`) and the first run after both the
insurance round (Depths 157–162) and the credit round (Depths
164–169) landed whole — the rounds' in-battery cross-feature
seams (the Borrowed Favor's dawn collection beside `hvgarage`'s
covered-sweep dawn and `hvrainbet`'s settlement, all three
priming the one-time survive-goal payouts so exact goodwill
deltas hold, and the Trader's Note's half-garnish beside
`voxpolicy`'s claim payouts on the same coin ledger) held clean
without pinning; the Hearthvale and Tycoon legs were verified by
their own one-shot suites at merge time, as always.

2026-08-25 (QA-10, post-Round-Twenty-One) — **all 67 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted Round-21
suites (`hvrainbet`, `voxcloud`) and the first run after the
wager round landed whole (Depths 150–155) — the round's
in-battery cross-feature seams (the Rain Bet's dawn settlement
against `hvweather`'s unpinned forecast promotion, with the
one-time survive-goal payouts primed so its exact goodwill
deltas stay exact, and the Cloud Wager's rain gates beside
`voxpig`'s shower-keyed truffle roots) held clean without
pinning; the Hearthvale and Tycoon legs were verified by their
own one-shot suites at merge time, as always.

2026-08-24 (QA-9, post-Round-Nineteen) — **all 63 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the two promoted Round-19
suites (`hvawning`, `voxcrib`) and the first run after the
architecture round landed whole (Depths 136–141) — the round's
in-battery cross-feature seams (the Awning's rain-day odds
against `hvweather`'s unpinned forecast rolls, and the Corn
Crib's softened peck against `voxcrow`'s full-bite raid
assertions, which stay true on a crib-less fresh save) held
clean without pinning; the Hearthvale and Tycoon legs were
verified by their own one-shot suites at merge time, as always.

2026-08-24 (QA-8, post-Round-Seventeen) — **all 59 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the four promoted Round-16/17
suites (`hvcoats`, `voxmuseum`, `hvtoolbox`, `voxowl`), and the
first run after two full rounds of features landed (Depths 115–127)
— the newest cross-feature seams (HV-24's tool box against
`hvweather`'s unpinned wobble rolls, VOX-19's night hunts against
`voxstardust`'s after-dark legs, HV-23's coat cut against the
matched-dawn drains in `hvweather` and `hvsnap`) all held clean
without pinning.

2026-08-24 (QA-7, post-Round-Fifteen) — **all 55 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment
baseline. First battery carrying the four promoted Round-14/15
suites (`hvnewcomer`, `voxferry`, `hvpantry`, `voxsugar`), and the
first run after two full rounds of features landed (Depths 101–113) —
the newest cross-feature seams (HV-22's pantry drip against the
older dawn suites, VOX-17's spring boils against `voxferry`'s
green-season dockings, LAB-24's halved sting odds against the party
suite's doubled ones) all held clean without pinning.

2026-08-24 (QA-6, post-Round-Thirteen) — **all 51 suites green
end-to-end on the first pass**, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment baseline.
First battery carrying the four promoted Round-12/13 suites (`hvbusk`,
`hvdeposit`, `voxwinter`, `voxice`), and the first run after the
Round-Thirteen features landed — notably the three cross-feature
seams QA-5 taught us to watch (HV-20's cans against the older
homeless-village suites, HVALE-17's fever against the hearthvale
weather legs, VOX-15's ice mode against `voxangler`'s casts) all held
clean without pinning.

2026-08-24 (QA-5, post-Round-Eleven) — **48 suites registered, 47
green on the first pass**. The one failure was real signal: HV-18's
new 25%-per-winter-dawn cold snap fired inside `hvweather`'s unpinned
matched-dawn legs (−10 warmth and a thinned panhandle roll), a
cross-feature interaction the battery caught exactly as designed. The
suite now pins the snap out (`SNAP_CHANCE = 0` — snaps have their own
suite, `hvsnap`) and re-ran green three times; the audit row held its
12/32 environment baseline throughout. First battery carrying the
four promoted Round-10/11 suites (`hvticket`, `hvsnap`, `voxballoon`,
`voxdove`).

2026-08-24 (QA-4, post-Round-Eight) — all **43 suites green**
end-to-end on the first pass, zero failures and zero stale
assertions, with the audit row holding its 12/32 environment baseline
while three Round-Nine flagship tranches merged around the run. This
was the first battery carrying the four promoted Round-7/8 suites
(`hvmeeting`, `hvpetition`, `voxlight`, `voxobs`).

The previous full run: 2026-08-24 (QA-3, post-Round-Four) — all **35 suites green**
end-to-end, zero stale assertions this time; the whole-site audit held
its environment baseline mid-run while flagship tranches merged around
it. The previous full run (QA-2, Depth 29) caught exactly one stale
assertion: `hvdog` had pinned the befriend goal as the *last* ladder
rung, which HV-9/HV-10 outgrew — fixed to be position-agnostic. Prefer
"contains"-style assertions over position-pinning for anything later
features can append to.

## Conventions

- Each suite is self-contained: it seeds `localStorage` in
  `addInitScript`, clears its own state on first load (guarded by
  `sessionStorage` so reload legs keep state), and asserts **exact**
  numbers computed in the same `page.evaluate` frame as the action —
  never across frames, where live sims drift.
- Randomness is pinned by swapping `Math.random` for one constant
  inside a single evaluate, chosen so the weighted branch under test is
  taken and the derived value is computable in the assertion.
- Every suite ends with a zero-page-errors check; `chromium.launch`
  uses `--no-sandbox --use-gl=swiftshader` so WebGL games run in CI
  containers.
