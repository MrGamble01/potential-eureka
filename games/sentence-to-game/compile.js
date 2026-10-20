/* Compilers turn a sentence into a playable spec.
   createLlmProvider() and createImageProvider() with no argument are
   the local stubs. They do not read a key and they do not call the
   network. openai, anthropic, and http stay on the same interfaces
   and refuse to run until a later host configures them.
   Kinds the cabinet knows: collect, dodge, break, hop, snake. */

export function createLlmProvider(id) {
  if (id === 'openai' || id === 'anthropic') return unconfiguredLlm(id);
  return stubLlm;
}

export function createImageProvider(id) {
  if (id === 'http') return unconfiguredImage();
  return stubImage;
}

export const stubLlm = {
  id: 'stub',
  async complete(prompt) {
    return stubSpec(prompt);
  },
};

export const stubImage = {
  id: 'stub',
  async illustrate(spec) {
    return { accent: spec.accent, mime: 'image/svg+xml' };
  },
};

function unconfiguredLlm(id) {
  return {
    id,
    async complete() {
      throw new Error(id + ' is not configured. Sentence to Game is using the local stub.');
    },
  };
}

function unconfiguredImage() {
  return {
    id: 'http',
    async illustrate() {
      throw new Error('Image provider is not configured. Sentence to Game draws locally.');
    },
  };
}

export function createCompiler(id) {
  if (id === 'model' || id === 'openai' || id === 'anthropic') return modelCompiler;
  return stubCompiler;
}

export const stubCompiler = {
  id: 'stub',
  async compile(prompt) {
    return stubSpec(prompt);
  },
};

export const modelCompiler = {
  id: 'model',
  async compile(prompt) {
    return stubLlm.complete(prompt);
  },
};

function titleFrom(prompt) {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Untitled cabinet';
  const short = clean.length > 42 ? clean.slice(0, 42).trim() + '…' : clean;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function stubSpec(prompt) {
  const p = String(prompt || '').toLowerCase();
  let kind = 'collect';
  if (/break|brick|paddle|pong/.test(p)) kind = 'break';
  else if (/dodge|avoid|fall|asteroid|storm/.test(p)) kind = 'dodge';
  else if (/jump|hop|platform|flap/.test(p)) kind = 'hop';
  else if (/snake|eat|grow/.test(p)) kind = 'snake';
  let accent = '#6C63FF';
  if (/pink|neon|magenta/.test(p)) accent = '#F778BA';
  else if (/gold|ash|amber|yellow/.test(p)) accent = '#e3b341';
  else if (/green|forest|leaf/.test(p)) accent = '#3FB950';
  else if (/blue|ice|water/.test(p)) accent = '#58A6FF';
  const goal = /hard|long/.test(p) ? 12 : 8;
  return { title: titleFrom(prompt), kind, accent, goal };
}
