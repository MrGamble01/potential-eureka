/* Server door for the flagship booth.
   createAiProvider picks the remote adapter only when AI_API_KEY
   is set. Otherwise the route reports the stub and does no work.
   The key never leaves this process. */

const { createAiProvider, dispatchAi } = require('../js/ai/arcade-ai');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  if (typeof req[Symbol.asyncIterator] !== 'function') return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

module.exports = async function handler(req, res) {
  if (!req || req.method !== 'POST') {
    send(res, 405, { error: 'POST only' });
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    send(res, 400, { error: 'bad json' });
    return;
  }
  const provider = createAiProvider(process.env);
  try {
    if (!body || body.op === 'ping' || body.op == null) {
      send(res, 200, { provider: provider.id });
      return;
    }
    if (provider.id !== 'remote') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const result = await dispatchAi(provider, body);
    send(res, 200, { provider: 'remote', result: result });
  } catch (e) {
    const status = e && e.status === 400 ? 400 : 502;
    send(res, status, { error: status === 400 ? 'unknown op' : 'provider failed' });
  }
};
