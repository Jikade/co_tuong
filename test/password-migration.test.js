import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import { hashPassword, verifyPassword, passwordFormat } from '../src/server/services/passwords.js';
import { createAccounts } from '../src/server/services/accounts.js';
import { createMemoryPersistence } from '../src/server/persistence/memory-persistence.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/aspnet-password.json', import.meta.url)));
const legacyUser = { id: 'legacy-test-user', username: 'olduser', displayName: 'Old user', email: 'old@example.test', passwordHash: fixture.hash, createdAt: 1 };
function generatedVector(marker, prf = 2) {
  const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex'), iterations = marker ? 100000 : 1000;
  const header = marker ? Buffer.alloc(13) : Buffer.from([0]);
  if (marker) { header[0] = 1; header.writeUInt32BE(prf, 1); header.writeUInt32BE(iterations, 5); header.writeUInt32BE(16, 9); }
  return Buffer.concat([header, salt, pbkdf2Sync('VectorPass123', salt, iterations, 32, marker ? ['sha1', 'sha256', 'sha512'][prf] : 'sha1')]).toString('base64');
}
test('migration verifies the original ASP.NET seed fixture without modifying it', async () => {
  assert.equal(passwordFormat(fixture.hash), 'aspnet-v3');
  assert.equal(await verifyPassword(fixture.password, fixture.hash), true);
  assert.equal(await verifyPassword('wrong-password', fixture.hash), false);
});
for (const [version, prf] of [[0, 0], [1, 0], [1, 1], [1, 2]]) test(`migration reads Identity V${version ? 3 : 2} PRF ${prf} format vector`, async () => {
  const h = generatedVector(version, prf);
  assert.equal(await verifyPassword('VectorPass123', h), true);
  assert.equal(await verifyPassword('VectorPass124', h), false);
});
test('migration rejects malformed and excessive KDF parameters without throwing', async () => {
  const excessive = Buffer.from(fixture.hash, 'base64'); excessive.writeUInt32BE(0xffffffff, 5);
  const invalidPrf = Buffer.from(fixture.hash, 'base64'); invalidPrf.writeUInt32BE(9, 1);
  const invalidSalt = Buffer.from(fixture.hash, 'base64'); invalidSalt.writeUInt32BE(0xffffffff, 9);
  for (const h of [null, '', 'not-base64', 'scrypt$bad$bad', fixture.hash.slice(0, -3), excessive.toString('base64'), invalidPrf.toString('base64'), invalidSalt.toString('base64')]) {
    assert.equal(await verifyPassword('Test@1234', h), false);
  }
});
test('migration keeps the scrypt format and Unicode passwords working', async () => {
  const h = await hashPassword('CờTướng123'); assert.equal(passwordFormat(h), 'scrypt');
  assert.equal(await verifyPassword('CờTướng123', h), true); assert.equal(await verifyPassword('CoTuong123', h), false);
});
test('legacy login upgrades only on success, keeps identity and restores opaque sessions after reload', async () => {
  const p = createMemoryPersistence({ accounts: { users: [legacyUser] } }); const a = createAccounts(p.accounts); await a.init();
  await assert.rejects(a.login({ username: legacyUser.username, password: 'wrong' }), /Thông tin/);
  assert.equal((await p.accounts.load()).users[0].passwordHash, fixture.hash);
  const login = await a.login({ username: legacyUser.username, password: fixture.password });
  assert.equal(login.user.id, legacyUser.id); const saved = await p.accounts.load();
  assert.match(saved.users[0].passwordHash, /^scrypt\$/); assert.equal(saved.sessions.length, 1);
  const restored = createAccounts(p.accounts); await restored.init(); assert.equal(restored.authenticate(login.token).user.id, legacyUser.id);
  await restored.logout(restored.authenticate(login.token).session.hash); assert.equal(restored.authenticate(login.token), null);
});
test('failed persistence cannot expose an upgraded hash or a new session', async () => {
  const state = { users: [legacyUser] }; const a = createAccounts({ load: async () => structuredClone(state), save: async () => { throw Error('storage down'); } }); await a.init();
  await assert.rejects(a.login({ username: legacyUser.username, password: fixture.password }), /storage down/);
  assert.equal(a.user(legacyUser.id).passwordHash, fixture.hash); assert.deepEqual(a.sessions(legacyUser.id), []);
});
test('disabled imported accounts cannot login, authenticate or request a reset', async () => {
  let sent = 0; const p = createMemoryPersistence({ accounts: { users: [{ ...legacyUser, active: false }] } });
  const a = createAccounts(p.accounts, { deliverReset: () => { sent++; } }); await a.init();
  await assert.rejects(a.login({ username: legacyUser.username, password: fixture.password }), /Thông tin/);
  await a.forgot(legacyUser.email, 'local'); assert.equal(sent, 0); assert.equal((await p.accounts.load()).resets.length, 0);
});
test('reset token is consumed once under concurrent requests and revokes existing sessions', async () => {
  let token; const p = createMemoryPersistence({ accounts: { users: [legacyUser] } }); const a = createAccounts(p.accounts, { deliverReset: (d) => { token = d.token; } }); await a.init();
  const session = await a.login({ username: legacyUser.username, password: fixture.password });
  await a.forgot(legacyUser.email, 'local');
  const body = { token, password: 'ChangedPass123', confirmPassword: 'ChangedPass123' };
  const results = await Promise.allSettled([a.reset(body), a.reset(body)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1); assert.equal(a.authenticate(session.token), null);
  assert.equal(a.validResetToken(token), false); assert.ok((await a.login({ username: legacyUser.username, password: body.password })).token);
});
