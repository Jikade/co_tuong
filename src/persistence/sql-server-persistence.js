import { assertPersistence } from './persistence-port.js';

function boolEnv(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function sqlConfigFromEnv(env = process.env) {
  const server = env.DB_SERVER?.trim();
  const database = env.DB_DATABASE?.trim();
  const user = env.DB_USER?.trim();
  const password = env.DB_PASSWORD;

  if (!server || !database || !user || !password) {
    throw new Error('Thiếu DB_SERVER, DB_DATABASE, DB_USER hoặc DB_PASSWORD.');
  }

  return {
    server,
    database,
    user,
    password,
    port: Number(env.DB_PORT || 1433),
    options: {
      encrypt: boolEnv(env.DB_ENCRYPT, false),
      trustServerCertificate: boolEnv(env.DB_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: {
      max: Number(env.DB_POOL_MAX || 10),
      min: Number(env.DB_POOL_MIN || 0),
      idleTimeoutMillis: Number(env.DB_POOL_IDLE_MS || 30_000),
    },
  };
}

async function loadMssql() {
  const imported = await import('mssql');
  return imported.default ?? imported;
}

/**
 * SQL Server bridge for Phase 4.
 *
 * It intentionally uses isolated runtime tables because Phase 4 currently has
 * client-generated string playerId values, while the official schema uses
 * dbo.nguoi_dung.ma BIGINT foreign keys. When Phase 1 authentication is merged,
 * only this adapter needs to be replaced/mapped to dbo.phong,
 * dbo.thanh_vien_phong, dbo.tran_dau, ... .
 */
export function createSqlServerPersistence({ env = process.env, sqlDriver } = {}) {
  let sql = sqlDriver;
  let pool;
  let connecting;
  let ready = false;

  async function getPool() {
    if (pool?.connected) return pool;
    if (connecting) return connecting;

    const attempt = (async () => {
      sql ??= await loadMssql();
      if (pool) {
        const stalePool = pool;
        await stalePool.close();
        if (pool === stalePool) pool = null;
      }

      const candidate = new sql.ConnectionPool(sqlConfigFromEnv(env));
      pool = candidate;
      candidate.on('error', (error) => console.error('SQL Server pool error:', error));
      try {
        await candidate.connect();
        return candidate;
      } catch (connectError) {
        try {
          await candidate.close();
        } catch (closeError) {
          throw new AggregateError(
            [connectError, closeError],
            'SQL Server connection failed and its pool could not be closed.',
            { cause: connectError },
          );
        }
        if (pool === candidate) pool = null;
        throw connectError;
      }
    })();
    connecting = attempt;
    try {
      return await attempt;
    } finally {
      if (connecting === attempt) connecting = null;
    }
  }

  async function ensureTables() {
    const db = await getPool();
    await db.request().query(`
      IF OBJECT_ID(N'dbo.phase4_room_state', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.phase4_room_state (
          room_code CHAR(6) NOT NULL CONSTRAINT PK_phase4_room_state PRIMARY KEY,
          state_payload NVARCHAR(MAX) NOT NULL,
          updated_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_phase4_room_state_updated DEFAULT SYSUTCDATETIME(),
          CONSTRAINT CK_phase4_room_state_json CHECK (ISJSON(state_payload) = 1)
        );
      END;

      IF OBJECT_ID(N'dbo.phase4_match_state', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.phase4_match_state (
          match_id NVARCHAR(128) NOT NULL CONSTRAINT PK_phase4_match_state PRIMARY KEY,
          state_payload NVARCHAR(MAX) NOT NULL,
          updated_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_phase4_match_state_updated DEFAULT SYSUTCDATETIME(),
          CONSTRAINT CK_phase4_match_state_json CHECK (ISJSON(state_payload) = 1)
        );
      END;
    `);
  }

  async function init() {
    await getPool();
    if (boolEnv(env.DB_AUTO_MIGRATE, false)) await ensureTables();
    ready = true;
  }

  async function queryRows(queryText) {
    const db = await getPool();
    return (await db.request().query(queryText)).recordset ?? [];
  }

  async function saveRooms(rooms) {
    if (!Array.isArray(rooms)) throw new TypeError('rooms.saveAll cần một array.');
    const db = await getPool();
    const tx = new sql.Transaction(db);
    await tx.begin();
    try {
      await new sql.Request(tx).query('DELETE FROM dbo.phase4_room_state;');
      for (const room of rooms) {
        if (!/^\d{6}$/.test(room?.code ?? '')) continue;
        const request = new sql.Request(tx);
        request.input('room_code', sql.Char(6), room.code);
        request.input('state_payload', sql.NVarChar(sql.MAX), JSON.stringify(room));
        await request.query(`
          INSERT INTO dbo.phase4_room_state(room_code, state_payload)
          VALUES (@room_code, @state_payload);
        `);
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
  }

  async function upsertMatch(record) {
    if (!record?.id) throw new TypeError('Match phải có id.');
    const db = await getPool();
    const request = db.request();
    request.input('match_id', sql.NVarChar(128), String(record.id));
    request.input('state_payload', sql.NVarChar(sql.MAX), JSON.stringify(record));
    await request.query(`
      MERGE dbo.phase4_match_state WITH (HOLDLOCK) AS target
      USING (SELECT @match_id AS match_id) AS source
      ON target.match_id = source.match_id
      WHEN MATCHED THEN
        UPDATE SET state_payload = @state_payload, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (match_id, state_payload) VALUES (@match_id, @state_payload);
    `);
    return record;
  }

  const adapter = {
    kind: 'sqlserver',
    init,
    rooms: {
      async loadAll() {
        const rows = await queryRows(
          'SELECT room_code, state_payload FROM dbo.phase4_room_state ORDER BY updated_at ASC;',
        );
        return rows.map((row) => JSON.parse(row.state_payload));
      },
      saveAll: saveRooms,
    },
    matches: {
      async loadAll() {
        const rows = await queryRows(
          'SELECT match_id, state_payload FROM dbo.phase4_match_state ORDER BY updated_at ASC;',
        );
        return rows.map((row) => JSON.parse(row.state_payload));
      },
      upsert: upsertMatch,
    },
    async health() {
      try {
        const db = await getPool();
        const result = await db.request().query('SELECT 1 AS ok;');
        return { ok: result.recordset?.[0]?.ok === 1, kind: 'sqlserver' };
      } catch (error) {
        return { ok: false, kind: 'sqlserver', error: error.message };
      }
    },
    async close() {
      ready = false;
      if (connecting) await connecting.catch(() => {});
      const currentPool = pool;
      if (currentPool) {
        await currentPool.close();
        if (pool === currentPool) pool = null;
      }
    },
    get ready() {
      return ready;
    },
  };

  return assertPersistence(adapter);
}
