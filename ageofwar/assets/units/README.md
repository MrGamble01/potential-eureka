# Age of War — unit sprite assets

Drop AI-generated unit art here and the game renders it instead of the
built-in canvas drawing. Until a unit's art exists, it falls back to the
hand-drawn / emoji art automatically, so nothing breaks while art is
incoming.

## How it works

1. Generate a sprite (see prompts below) and export a **transparent PNG**.
2. Name it `<key>.png` (the keys are in the table below) and put it in this
   folder: `ageofwar/assets/units/`.
3. Tell me it's in, or add the key to `SPRITE_MANIFEST` in
   `js/ageofwar.js` (e.g. `club: {}`). I'll switch it on and fine-tune the
   on-screen size with `{ scale: 1.1 }` if needed.
4. It appears on the Vercel preview. Convert units one at a time — no need
   to do all 20 at once.

## Image spec (read this before generating)

- **Side view, facing RIGHT**, full body, standing/marching pose.
- **Transparent background** (PNG with alpha). No scenery, no ground, no
  drop shadow (the game draws the shadow), no text, no UI.
- **One character, centered**, feet touching the **bottom edge** of the
  canvas, small headroom at the top. The game anchors the image at the feet.
- Square canvas, ~768×768 (heroes/vehicles can be wider — that's fine, the
  engine preserves aspect ratio).
- Consistent **cartoon game-sprite** style across all units: bold clean
  shapes, soft cel-shading, **light from the top-left**, slightly comic
  "Age of War" flavor.
- Keep heights consistent within a tier so melee/ranged/heavy read at
  similar scale.

**Append this style suffix to every prompt** for consistency:

> `, clean 2D cartoon game sprite, bold readable silhouette, soft cel shading, light from top-left, side view facing right, full body centered with feet at the bottom edge, transparent background, no text, no ground, no shadow`

## Per-unit prompts

| Key | Unit | Prompt (add the style suffix above) |
|-----|------|--------------------------------------|
| `club` | Clubman | Stocky Stone Age caveman in a brown fur tunic gripping a big gnarled wooden club, shaggy black hair, heavy brow |
| `sling` | Slinger | Lean Stone Age caveman hunter whirling a leather sling with a stone overhead, fur loincloth |
| `dino` | Dino Rider | Small green cartoon raptor dinosaur with a caveman rider on its back holding a short spear |
| `swordsman` | Swordsman | Medieval foot soldier in chainmail and a blue tabard, steel sword raised and a round wooden shield |
| `archer` | Archer | Medieval archer in a green hooded tunic drawing a longbow, leather quiver on the back |
| `knight` | Knight | Armored knight on an armored warhorse couching a lance, plate armor and a plumed helm |
| `rifleman` | Rifleman | Early-1900s infantry rifleman in a wool uniform and peaked cap holding a bolt-action rifle |
| `cannon` | Cannoneer | Industrial-era artillery crewman beside a small wheeled field cannon, holding a ramrod |
| `tank1` | Steam Tank | Boxy steampunk early tank, riveted iron plates, a smokestack, and tracked treads |
| `soldier` | Soldier | Modern soldier in green camo fatigues and a combat helmet aiming an assault rifle |
| `sniper` | Sniper | Modern sniper in a tattered ghillie cloak kneeling/standing with a long scoped sniper rifle |
| `tank2` | Tank | Modern olive-green main battle tank, low hull, long turret cannon, tracked treads |
| `laser` | Laser Trooper | Sleek alien soldier in glowing teal power armor firing a blue energy laser rifle |
| `mech` | Mech | Bipedal battle-mech robot with shoulder cannons, sleek metal plating and glowing purple accents |
| `flier` | Hover | Futuristic hovering combat saucer/drone with a pink energy glow underneath |
| `hero_grog` | Grog the Stomper *(hero)* | Epic giant woolly mammoth with a tribal caveman chief riding on top swinging a huge bone club, big curved tusks, shaggy brown fur |
| `hero_paladin` | Sir Lancelot *(hero)* | Epic heroic paladin in shining silver plate armor with a glowing longsword and a kite shield, white plume |
| `hero_general` | The General *(hero)* | Epic decorated war general in a medal-covered uniform, commanding pose with a saber and pistol |
| `hero_seal` | Black Ops *(hero)* | Epic elite special-forces operative in black tactical gear and night-vision goggles, suppressed carbine |
| `hero_titan` | Titan *(hero)* | Epic colossal futuristic war-titan robot with a glowing blue energy core, heavy armor and arm cannons |

> Tip: generate each tier in one batch with the **same** style reference /
> seed so a unit family looks like it belongs together. Heroes should look
> bigger and more ornate than regular units.
