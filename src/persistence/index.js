import { createMemoryPersistence } from './memory-persistence.js';
import { createSqlServerPersistence } from './sql-server-persistence.js';

export function createPersistenceFromEnv(env = process.env) {
  const mode = (env.DB_MODE || 'memory').trim().toLowerCase();
  if (mode === 'sqlserver' || mode === 'mssql') {
    return createSqlServerPersistence({ env });
  }
  if (mode !== 'memory') {
    throw new Error(`DB_MODE không hỗ trợ: ${mode}`);
  }
  return createMemoryPersistence();
}

export { createMemoryPersistence } from './memory-persistence.js';
export { createSqlServerPersistence } from './sql-server-persistence.js';
