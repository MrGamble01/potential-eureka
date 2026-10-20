/* Ashmarch storytellers.
   The page calls createProvider() with no argument, which is the local
   stub. Cloud providers keep the same turn() shape for later and are
   not selected unless a caller passes their id. They do not read a
   key from the repo, and the stub never touches the network. */

export function createProvider(id) {
  if (id === 'openai') return openaiProvider;
  if (id === 'anthropic') return anthropicProvider;
  return stubProvider;
}

export const stubProvider = {
  id: 'stub',
  label: 'Local stub',
  async turn(state, action) {
    return scriptTurn(state, action);
  },
};

export const openaiProvider = {
  id: 'openai',
  label: 'OpenAI',
  async turn() {
    throw new Error('OpenAI storyteller is not configured. Ashmarch is playing the local stub.');
  },
};

export const anthropicProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  async turn() {
    throw new Error('Anthropic storyteller is not configured. Ashmarch is playing the local stub.');
  },
};

const SCENES = {
  gate: {
    motif: 'gate',
    text: 'Ash falls like slow snow on the march. A timber gate stands open, and the road beyond it is the only dark line in the white. Your lamp is cold.',
    choices: [
      { label: 'Light the lamp and take the road', to: 'road', item: 'lamp' },
      { label: 'Search the ditch before you go', to: 'ditch' },
    ],
  },
  ditch: {
    motif: 'ditch',
    text: 'The ditch holds a coil of wire, a cracked compass, and the print of something that walked on two feet and then four. The compass needle shivers toward the gate.',
    choices: [
      { label: 'Pocket the compass', to: 'road', item: 'compass' },
      { label: 'Leave it. The road is waiting', to: 'road' },
    ],
  },
  road: {
    motif: 'figure',
    text: 'A figure sits on a mile-stone, coat the same grey as the ash. They do not look up. "The beacon is two turns on," they say. "Most people sell the lamp before the second turn."',
    choices: [
      { label: 'Ask what the beacon costs', to: 'price' },
      { label: 'Pass them without a word', to: 'fork' },
    ],
  },
  price: {
    motif: 'figure',
    text: '"A story you have not told yet," the figure says. "Or the lamp. The road eats one of them either way." Their hand is open, palm full of ash.',
    choices: [
      { label: 'Give them the lamp', to: 'dark', requires: 'lamp', spend: 'lamp' },
      { label: 'Tell them you are going through', to: 'fork' },
      { label: 'You have no lamp. Keep walking', to: 'fork', hideIf: 'lamp' },
    ],
  },
  dark: {
    motif: 'dark',
    text: 'Without the lamp the ash thickens. You walk by the sound of your own feet. Somewhere ahead a bell rings once, then the road tilts and you are back at the gate, pockets lighter.',
    choices: [
      { label: 'Begin the march again', to: 'gate', reset: true },
    ],
  },
  fork: {
    motif: 'fork',
    text: 'The road splits. Left, the ash is knee-deep and something moves under it. Right, the ground is packed and a red point of light sits on the horizon.',
    choices: [
      { label: 'Wade left, into the deep ash', to: 'wade' },
      { label: 'Take the packed road toward the light', to: 'beacon' },
    ],
  },
  wade: {
    motif: 'wade',
    text: 'The thing under the ash is a cart, half buried, bell still tied to the axle. You can drag it free or leave it singing to nobody.',
    choices: [
      { label: 'Haul the cart up onto the road', to: 'beacon', item: 'bell' },
      { label: 'Leave it and climb back', to: 'beacon' },
    ],
  },
  beacon: {
    motif: 'beacon',
    text: 'The beacon is a cage of iron and a fire that does not mind the ash. A keeper sleeps against the windbreak. The march ends where the light starts.',
    choices: [
      { label: 'Ring what you carried', to: 'rung', requires: 'bell' },
      { label: 'Set the compass on the step', to: 'kept', requires: 'compass' },
      { label: 'Wake the keeper', to: 'kept' },
    ],
  },
  rung: {
    motif: 'beacon',
    ending: 'bell',
    text: 'The bell answers the beacon. The keeper wakes, nods as if you were expected, and the ash on your coat lifts and does not come back down. The march is over.',
    choices: [
      { label: 'Walk it again', to: 'gate', reset: true },
    ],
  },
  kept: {
    motif: 'beacon',
    ending: 'light',
    text: 'The keeper takes whatever you still have — lamp, compass, or only the story of the road — and feeds it to the fire. The flame jumps. You can see the gate from here. You made it.',
    choices: [
      { label: 'Walk it again', to: 'gate', reset: true },
    ],
  },
};

function visibleChoices(scene, items) {
  return (scene.choices || []).filter((choice) => {
    if (choice.hideIf && items.includes(choice.hideIf)) return false;
    if (choice.requires && !items.includes(choice.requires)) return false;
    return true;
  });
}

function scriptTurn(state, action) {
  const items = Array.isArray(state.items) ? state.items.slice() : [];
  let id = state.scene || 'gate';
  if (action && action.to) {
    const from = SCENES[id] || SCENES.gate;
    const choice = (from.choices || []).find((c) => c.to === action.to && c.label === action.label) ||
      (from.choices || []).find((c) => c.to === action.to);
    if (choice) {
      if (choice.reset) items.length = 0;
      if (choice.spend) {
        const at = items.indexOf(choice.spend);
        if (at >= 0) items.splice(at, 1);
      }
      if (choice.item && !items.includes(choice.item)) items.push(choice.item);
      id = choice.to;
    }
  }
  const scene = SCENES[id] || SCENES.gate;
  return {
    scene: id,
    text: scene.text,
    motif: scene.motif,
    ending: scene.ending || null,
    items,
    choices: visibleChoices(scene, items).map((c) => ({ label: c.label, to: c.to })),
  };
}

export function opening() {
  return scriptTurn({ scene: 'gate', items: [] }, null);
}
