/* Compilers turn a sentence into a playable spec.
   createCompiler() with no argument is the local stub and does not
   call the network. A later model compiler must return the same shape:
   { title, kind, accent, goal }. Kinds the cabinet knows: collect,
   dodge, break, hop, snake. */

export function createCompiler(id) {
  if (id === 'model') return modelCompiler;
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
    return stubSpec(prompt);
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
