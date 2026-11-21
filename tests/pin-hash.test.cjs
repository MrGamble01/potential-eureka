const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/personal-auth.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.PersonalAuth = PersonalAuth;', vm.createContext(sandbox), { filename: 'js/personal-auth.js' });
const hashPin = sandbox.PersonalAuth.rules.hashPin;

test('the same code hashes the same way, and the hash is not the code', () => {
  assert.equal(hashPin('1234'), hashPin('1234'));
  assert.notEqual(hashPin('1234'), hashPin('1235'));
  assert.equal(hashPin(''), hashPin(''));
  const hashed = hashPin('1234');
  assert.match(hashed, /^h_[0-9a-z]+$/);
  assert.equal(hashed.includes('1234'), false);
});
