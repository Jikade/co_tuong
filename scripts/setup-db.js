import { readFile } from 'node:fs/promises';
import { createSqlConnection, sqlValue } from '../src/server/persistence/sql-connection.js';

// Explicitly refuses a partially populated base schema. Never rebuild an existing DB.
export async function setupDatabase(env = process.env) {
  const db = createSqlConnection(env);
  try {
    const [{ count }] = await db.json("SELECT COUNT(*) AS count FROM sys.tables WHERE name IN ('nguoi_dung','phong','tran_dau')");
    if (count === 0) {
      const [{ count: tableCount }] = await db.json('SELECT COUNT(*) AS count FROM sys.tables');
      if (tableCount !== 0) throw new Error('Database không trống: không tự cài schema gốc vào database khác.');
      const base = await readFile(new URL('../database/01_schema_phase1.sql', import.meta.url), 'utf8');
      // GO is a sqlcmd separator, not a server statement. Each batch is sent explicitly.
      const batches = base.split(/^\s*GO\s*$/mi).filter((b) => b.trim());
      await db.execute('BEGIN TRANSACTION; DECLARE @batch nvarchar(max);\n' + batches.map((b) => `SET @batch=${sqlValue(b)}; EXEC sys.sp_executesql @batch;`).join('\n') + '\nCOMMIT;');
    } else if (count !== 3) throw new Error('Schema gốc chưa đầy đủ; cần kiểm tra thủ công.');
    const migration = await readFile(new URL('../database/03_integration.sql', import.meta.url), 'utf8');
    await db.execute(migration);
    const [counts] = await db.json("SELECT (SELECT COUNT(*) FROM sys.tables WHERE name NOT LIKE 'integration[_]%' AND name <> 'yeu_cau_chong_lap') AS baseTables, (SELECT COUNT(*) FROM sys.views WHERE name LIKE 'v[_]%') AS views");
    if (counts.baseTables !== 24 || counts.views !== 5) throw new Error(`Schema không đúng kỳ vọng: ${JSON.stringify(counts)}`);
    return counts;
  } finally { await db.close(); }
}
if (process.argv[1]?.endsWith('setup-db.js')) console.log(await setupDatabase());
