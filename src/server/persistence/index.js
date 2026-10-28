import { createMemoryPersistence } from './memory-persistence.js';
import { createFilePersistence } from './file-persistence.js';
import { createIntegrationSqlPersistence } from './integration-sql-persistence.js';

export function createPersistenceFromEnv(env = process.env) {
  const mode = (env.DB_MODE || 'file').trim().toLowerCase();
  if (mode === 'sqlserver' || mode === 'mssql') {
    return createIntegrationSqlPersistence({ env });
  }
  if (mode === 'file') return createFilePersistence(env.DATA_FILE);
  if (mode !== 'memory') {
    throw new Error(`DB_MODE không hỗ trợ: ${mode}`);
  }
  return createMemoryPersistence();
}

export { createMemoryPersistence } from './memory-persistence.js';
export { createIntegrationSqlPersistence } from './integration-sql-persistence.js';
