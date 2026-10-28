import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const projectPath = (value) => path.resolve(PROJECT_ROOT, value);

function integer(value, fallback, name, minimum, maximum) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} phải là số nguyên từ ${minimum} đến ${maximum}.`);
  }
  return parsed;
}

function boolean(value, fallback, name) {
  if (value == null || value === '') return fallback;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  throw new Error(`${name} phải là true hoặc false.`);
}

export function readServerConfig(env = process.env) {
  const config = {
    host: env.APP_HOST || '0.0.0.0',
    port: integer(env.PORT, 3001, 'PORT', 1, 65535),
    staticDir: projectPath(env.STATIC_DIR || 'dist'),
    mailOutbox: projectPath(env.MAIL_OUTBOX || 'data/outbox'),
    tlsCertFile: env.TLS_CERT_FILE ? projectPath(env.TLS_CERT_FILE) : undefined,
    tlsKeyFile: env.TLS_KEY_FILE ? projectPath(env.TLS_KEY_FILE) : undefined,
  };
  validateTlsFiles(config);
  return config;
}

function validateTlsFiles({ tlsCertFile, tlsKeyFile }) {
  if (Boolean(tlsCertFile) !== Boolean(tlsKeyFile)) {
    throw new Error('Set both TLS_CERT_FILE and TLS_KEY_FILE to enable HTTPS.');
  }
}

export function readTlsOptions(files) {
  validateTlsFiles(files);
  if (!files.tlsCertFile) return undefined;
  return { cert: readFileSync(files.tlsCertFile), key: readFileSync(files.tlsKeyFile) };
}

export function readPersistenceConfig(env = process.env) {
  const mode = (env.DB_MODE || 'file').trim().toLowerCase();
  if (!['file', 'memory', 'sqlserver', 'mssql'].includes(mode)) throw new Error(`DB_MODE không hỗ trợ: ${mode}`);
  return { mode, dataFile: projectPath(env.DATA_FILE || 'data/integration.json') };
}

export function readSqlConfig(env = process.env) {
  const driver = env.DB_DRIVER || 'mssql';
  if (!['sqlcmd', 'mssql'].includes(driver)) throw new Error(`DB_DRIVER không hỗ trợ: ${driver}`);
  const pool = {
    max: integer(env.DB_POOL_MAX, 10, 'DB_POOL_MAX', 1, 1000),
    min: integer(env.DB_POOL_MIN, 0, 'DB_POOL_MIN', 0, 1000),
    idleTimeoutMillis: integer(env.DB_POOL_IDLE_MS, 30000, 'DB_POOL_IDLE_MS', 0, 2147483647),
  };
  if (pool.min > pool.max) throw new Error('DB_POOL_MIN không được lớn hơn DB_POOL_MAX.');
  return {
    driver,
    sqlcmdPath: env.SQLCMD_PATH || 'sqlcmd',
    autoMigrate: boolean(env.DB_AUTO_MIGRATE, false, 'DB_AUTO_MIGRATE'),
    connection: {
      server: env.DB_SERVER, database: env.DB_DATABASE, user: env.DB_USER, password: env.DB_PASSWORD,
      port: integer(env.DB_PORT, 1433, 'DB_PORT', 1, 65535),
      options: {
        encrypt: boolean(env.DB_ENCRYPT, true, 'DB_ENCRYPT'),
        trustServerCertificate: boolean(env.DB_TRUST_SERVER_CERTIFICATE, false, 'DB_TRUST_SERVER_CERTIFICATE'),
      },
      pool,
    },
  };
}
