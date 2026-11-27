const assert = require('node:assert/strict');
const test = require('node:test');
const Audio = require('../js/audio.js');

test('safeResume swallows a rejected or throwing resume', async () => {
  let unhandled = null;
  const onReject = (err) => { unhandled = err; };
  process.on('unhandledRejection', onReject);

  Audio.safeResume(null);
  Audio.safeResume({ state: 'running', resume() { throw new Error('should not run'); } });
  assert.doesNotThrow(() => Audio.safeResume({
    state: 'suspended',
    resume() { throw new Error('sync'); },
  }));
  Audio.safeResume({
    state: 'interrupted',
    resume() { return Promise.reject(new Error('AudioContext')); },
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  process.off('unhandledRejection', onReject);
  assert.equal(unhandled, null);
});

test('needsResume covers the iOS interrupted state', () => {
  assert.equal(Audio.needsResume('suspended'), true);
  assert.equal(Audio.needsResume('interrupted'), true);
  assert.equal(Audio.needsResume('running'), false);
  assert.equal(Audio.needsResume('closed'), false);
});
