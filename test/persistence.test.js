import test from 'node:test';
import assert from 'node:assert/strict';
import { createSqlServerPersistence } from '../src/persistence/sql-server-persistence.js';

function fakeDriver({ failConnectCount = 0, failCloseCount = 0 } = {}) {
  const pools = [];
  class ConnectionPool {
    constructor() {
      this.connected = false;
      this.closed = false;
      this.closeCalls = 0;
      this.handlers = new Map();
      pools.push(this);
    }

    on(event, handler) {
      this.handlers.set(event, handler);
      return this;
    }

    async connect() {
      if (failConnectCount > 0) {
        failConnectCount -= 1;
        throw new Error('connect failed');
      }
      this.connected = true;
      return this;
    }

    async close() {
      this.closeCalls += 1;
      if (failCloseCount > 0) {
        failCloseCount -= 1;
        throw new Error('close failed');
      }
      this.connected = false;
      this.closed = true;
    }
  }

  return { driver: { ConnectionPool }, pools };
}

const env = {
  DB_SERVER: 'unused',
  DB_DATABASE: 'unused',
  DB_USER: 'unused',
  DB_PASSWORD: 'unused',
};

test('failed concurrent initialization closes the pool and a later initialization retries cleanly', async () => {
  const { driver, pools } = fakeDriver({ failConnectCount: 1 });
  const persistence = createSqlServerPersistence({ env, sqlDriver: driver });

  const firstAttempts = await Promise.allSettled([persistence.init(), persistence.init()]);
  assert.deepEqual(firstAttempts.map((result) => result.status), ['rejected', 'rejected']);
  assert.equal(pools.length, 1, 'concurrent calls share the same connection attempt');
  assert.equal(pools[0].closed, true, 'failed pool is closed before retry');
  assert.equal(persistence.ready, false);

  await persistence.init();
  assert.equal(pools.length, 2);
  assert.equal(pools[1].connected, true);
  assert.equal(persistence.ready, true);
  await persistence.close();
  assert.equal(pools[1].closed, true);
  assert.equal(persistence.ready, false);
});

test('reports both connection and pool-close errors after a failed initialization', async () => {
  const { driver, pools } = fakeDriver({ failConnectCount: 1, failCloseCount: 1 });
  const persistence = createSqlServerPersistence({ env, sqlDriver: driver });

  await assert.rejects(persistence.init(), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /connect failed/);
    assert.match(error.errors[1].message, /close failed/);
    assert.match(error.cause.message, /connect failed/);
    return true;
  });
  assert.equal(pools.length, 1);
  assert.equal(persistence.ready, false);

  await persistence.init();
  assert.equal(pools.length, 2, 'the failed pool is not reused');
  assert.equal(pools[0].closed, true, 'retry closes the failed pool before creating another');
  assert.equal(pools[0].closeCalls, 2);
  await persistence.close();
});
