import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntegrationSqlPersistence } from '../src/server/persistence/integration-sql-persistence.js';
import { sqlValue } from '../src/server/persistence/sql-connection.js';
function room(id, code) { return { id, code, name: id, visibility: 'public', host: { id: `user-${id}`, name: id, ready: false }, opponent: null, spectators: [], blocked: [], match: null, lastActivityAt: 10, lastPersistAt: 1 }; }
function fixture() {
  const original = [room('room-a', '910001'), room('room-b', '910002')], writes = [];
  let fail = false, reads = 0;
  const connection = { async json() { reads++; return original.map((r) => ({ payload: JSON.stringify(r) })); }, async execute(sql) { writes.push(sql); if (fail) { fail = false; throw Error('transaction rolled back'); } }, async close() {} };
  const persistence = createIntegrationSqlPersistence({ connection });
  return { original, writes, persistence, failNext() { fail = true; }, reads: () => reads };
}
test('room snapshots do not rewrite unchanged rooms when only the runtime save timestamp changes', async () => {
  const f = fixture(); const rooms = await f.persistence.rooms.loadAll();
  for (const r of rooms) r.lastPersistAt = Date.now();
  await f.persistence.rooms.saveAll(rooms); assert.equal(f.writes.length, 0);
});
test('changing one room projects only that room and does not blanket-deactivate all rooms', async () => {
  const f = fixture(); const rooms = await f.persistence.rooms.loadAll(); rooms[0].host.ready = true;
  await f.persistence.rooms.saveAll(rooms); assert.equal(f.writes.length, 1);
  assert.ok(f.writes[0].includes(sqlValue('room-a'))); assert.ok(!f.writes[0].includes(sqlValue('room-b')));
  assert.doesNotMatch(f.writes[0], /UPDATE dbo\.integration_room_state SET active=0;/);
});
test('snapshot cache advances only after transaction commit, so rollback can be retried', async () => {
  const f = fixture(); const rooms = await f.persistence.rooms.loadAll(); rooms[0].name = 'Retry'; f.failNext();
  await assert.rejects(f.persistence.rooms.saveAll(rooms), /rolled back/);
  await f.persistence.rooms.saveAll(rooms); await f.persistence.rooms.saveAll(rooms);
  assert.equal(f.writes.length, 2, 'one failed transaction and one retry; no third replay');
});
test('queued identical snapshots compare against the previous committed snapshot', async () => {
  const f = fixture(); const rooms = await f.persistence.rooms.loadAll(); rooms[0].host.ready = true;
  await Promise.all([f.persistence.rooms.saveAll(rooms), f.persistence.rooms.saveAll(structuredClone(rooms))]);
  assert.equal(f.writes.length, 1);
});
test('room removal and reopening are scoped and leave the other room untouched', async () => {
  const f = fixture(); const rooms = await f.persistence.rooms.loadAll();
  await f.persistence.rooms.saveAll([rooms[0]]); assert.equal(f.writes.length, 1);
  assert.ok(f.writes[0].includes(sqlValue('room-b'))); assert.ok(!f.writes[0].includes(sqlValue('room-a')));
  await f.persistence.rooms.saveAll([rooms[0]]); assert.equal(f.writes.length, 1);
  await f.persistence.rooms.saveAll(rooms); assert.equal(f.writes.length, 2); assert.ok(!f.writes[1].includes(sqlValue('room-a')));
});
test('saveAll without loadAll still discovers existing rows before deciding removals', async () => {
  const f = fixture(); await f.persistence.rooms.saveAll(f.original);
  assert.equal(f.reads(), 1); assert.equal(f.writes.length, 0);
});
