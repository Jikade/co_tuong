import { createMemoryPersistence } from './memory-persistence.js';
import { createFilePersistence } from './file-persistence.js';
import { createIntegrationSqlPersistence } from './integration-sql-persistence.js';
import { readPersistenceConfig } from '../config.js';

export function createPersistenceFromEnv(env = process.env) {
  const { mode, dataFile } = readPersistenceConfig(env);
  if (mode === 'sqlserver' || mode === 'mssql') {
    return createIntegrationSqlPersistence({ env });
  }
  if (mode === 'file') return createFilePersistence(dataFile);
  return createMemoryPersistence();
}

export { createMemoryPersistence } from './memory-persistence.js';
export { createIntegrationSqlPersistence } from './integration-sql-persistence.js';
