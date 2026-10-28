import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const run = promisify(execFile);
const settings = 'SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;\n';

// Encode Unicode values as binary literals; no user data is interpolated as SQL syntax.
export function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Invalid SQL number');
    return String(value);
  }
  return `CONVERT(nvarchar(max),0x${Buffer.from(String(value), 'utf16le').toString('hex')})`;
}
export const sqlDate = (value) => value == null ? 'NULL' : `CONVERT(datetime2(3),${sqlValue(new Date(value).toISOString())},127)`;

export function createSqlConnection(env = process.env) {
  let pool;
  const driver = env.DB_DRIVER || 'mssql';
  async function execute(text) {
    if (!env.DB_SERVER || !env.DB_DATABASE) throw new Error('Cần DB_SERVER và DB_DATABASE.');
    if (driver === 'sqlcmd') {
      const directory = path.resolve('data/sql-temp');
      await mkdir(directory, { recursive: true });
      const filename = path.join(directory, `${randomUUID()}.sql`);
      await writeFile(filename, '\ufeff' + settings + text, 'utf8');
      try {
        const args = ['-S', env.DB_SERVER, '-d', env.DB_DATABASE, '-E', '-C', '-b', '-r', '1', '-y', '0', '-w', '65535', '-f', '65001', '-l', '10', '-i', filename];
        const result = await run(env.SQLCMD_PATH || 'sqlcmd', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 60000 });
        return result.stdout;
      } catch (error) {
        throw new Error(`SQL Server: ${(error.stderr || error.stdout || error.message).trim()}`);
      } finally { await unlink(filename); }
    }
    if (driver !== 'mssql') throw new Error(`DB_DRIVER không hỗ trợ: ${driver}`);
    if (!pool) {
      const { default: sql } = await import('mssql');
      const candidate = new sql.ConnectionPool({
        server: env.DB_SERVER, database: env.DB_DATABASE, user: env.DB_USER, password: env.DB_PASSWORD,
        port: Number(env.DB_PORT || 1433),
        options: { encrypt: env.DB_ENCRYPT !== 'false', trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE === 'true' },
      });
      candidate.on('error', (error) => console.error('SQL pool:', error.message));
      try { await candidate.connect(); pool = candidate; } catch (error) { await candidate.close(); throw error; }
    }
    const result = await pool.request().batch(settings + text);
    return result.recordset?.[0]?.payload ?? '';
  }
  return {
    execute,
    async json(select) {
      const hex = await execute(`DECLARE @json_result nvarchar(max)=(${select} FOR JSON PATH); SELECT CONVERT(varchar(max),CONVERT(varbinary(max),COALESCE(@json_result,N'[]')),2) AS payload;`);
      const compact = String(hex).replace(/\s/g, '');
      if (!/^[a-f\d]*$/i.test(compact)) throw new Error('Invalid SQL result encoding');
      return JSON.parse(Buffer.from(compact, 'hex').toString('utf16le') || '[]');
    },
    async close() { if (pool) await pool.close(); pool = null; },
  };
}
