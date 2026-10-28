import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSqlConnection, sqlValue as v } from '../src/server/persistence/sql-connection.js';
import { passwordFormat } from '../src/server/services/passwords.js';

// Offline, explicitly invoked bridge for accounts already in the same SQL DB.
// The default path is read-only. It never changes a base password hash, revokes
// a legacy session, rewrites a Room/Match, or deletes old data.
export async function importPhase1Accounts({ env = process.env, apply = false, serverStopped = false, onlyUserIds = [] } = {}) {
  if (apply && !serverStopped) throw new Error('Stop the application and explicitly set serverStopped before applying an import.');
  if (onlyUserIds.some((id) => !/^[1-9]\d{0,18}$/.test(String(id)))) throw new Error('Invalid legacy user ID filter.');
  const db = createSqlConnection(env);
  try {
    const [snapshot] = await db.json('SELECT payload,version FROM dbo.integration_account_state WHERE singleton=1');
    if (!snapshot) throw new Error('Run db:setup and initialize integration persistence first.');
    if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 0) throw new Error('Unsupported account version.');
    const state = { users: [], sessions: [], resets: [], resetRequests: [], friends: [], friendRequests: [], invites: [], notifications: [], ...JSON.parse(snapshot.payload) };
    for (const name of ['users','sessions','resets','resetRequests','friends','friendRequests','invites','notifications']) if (!Array.isArray(state[name])) throw new Error('Invalid account snapshot.');
    const rows = await db.json(`SELECT CONVERT(varchar(30),u.ma) AS legacyId,u.ten_dang_nhap AS username,u.ten_hien_thi AS displayName,u.email,u.mat_khau_bam AS passwordHash,u.dang_hoat_dong AS active,u.ngay_tao AS createdAt
      FROM dbo.nguoi_dung u WHERE NOT EXISTS(SELECT 1 FROM dbo.integration_user_map m WHERE m.user_id=u.ma)
      ${onlyUserIds.length ? `AND u.ma IN (${onlyUserIds.map((id) => v(String(id))).join(',')})` : ''}`);
    const unsupported = rows.filter((u) => passwordFormat(u.passwordHash) === 'unsupported');
    const existingMap = await db.json('SELECT external_id,CONVERT(varchar(30),user_id) AS legacyId FROM dbo.integration_user_map');
    if (existingMap.some((m) => !state.users.some((u) => u.id === m.external_id))) throw new Error('Account mappings and snapshot disagree; review before importing.');
    const map = new Map(existingMap.map((m) => [m.legacyId, m.external_id]));
    const keys = new Set(state.users.flatMap((u) => ['u:' + u.username.trim().toLowerCase(), 'e:' + u.email.trim().toLowerCase()]));
    for (const row of rows) {
      const identity = `phase1-sql-user-${row.legacyId}`;
      if (state.users.some((u) => u.id === identity) || keys.has('u:' + row.username.trim().toLowerCase()) || keys.has('e:' + row.email.trim().toLowerCase())) throw new Error('Legacy account identity conflicts with an existing integration account. No import applied.');
      keys.add('u:' + row.username.trim().toLowerCase()); keys.add('e:' + row.email.trim().toLowerCase()); map.set(row.legacyId, identity);
      const date = /(?:Z|[+-]\d\d:\d\d)$/.test(row.createdAt) ? row.createdAt : row.createdAt + 'Z';
      state.users.push({ id: identity, username: row.username, displayName: row.displayName, email: row.email.trim().toLowerCase(), passwordHash: row.passwordHash, active: Boolean(row.active), createdAt: Date.parse(date) });
    }
    const relations = await db.json('SELECT CONVERT(varchar(30),ma_nguoi_dung_nho) AS lowId,CONVERT(varchar(30),ma_nguoi_dung_lon) AS highId FROM dbo.ban_be');
    const pairs = new Set(state.friends.map((p) => [...p].sort().join(':')));
    let addedFriends = 0;
    for (const r of relations) if (map.has(r.lowId) && map.has(r.highId)) {
      const pair = [map.get(r.lowId), map.get(r.highId)].sort(), key = pair.join(':');
      if (!pairs.has(key)) { state.friends.push(pair); pairs.add(key); addedFriends++; }
    }
    const requests = await db.json(`SELECT CONVERT(varchar(30),r.ma) AS legacyId,CONVERT(varchar(30),r.ma_nguoi_gui) AS sender,CONVERT(varchar(30),r.ma_nguoi_nhan) AS recipient,r.trang_thai AS status,r.ngay_tao AS createdAt
      FROM dbo.loi_moi_ket_ban r WHERE NOT EXISTS(SELECT 1 FROM dbo.integration_friend_request_map m WHERE m.request_id=r.ma)`);
    const addedRequests = requests.filter((r) => map.has(r.sender) && map.has(r.recipient)).map((r) => ({ ...r, externalId: randomUUID() }));
    for (const r of addedRequests) state.friendRequests.push({ id: r.externalId, from: map.get(r.sender), to: map.get(r.recipient), status: r.status === 'Rejected' ? 'Declined' : r.status, createdAt: Date.parse(r.createdAt + (r.createdAt.endsWith('Z') ? '' : 'Z')) });
    const summary = { candidateUsers: rows.length, unsupportedHashes: unsupported.length, addedFriends, addedFriendRequests: addedRequests.length, applied: false };
    if (!apply) return summary;
    if (unsupported.length) throw new Error('Unsupported legacy password format; import not applied.');
    if (!rows.length && !addedFriends && !addedRequests.length) return { ...summary, applied: true };
    let sql = `IF NOT EXISTS(SELECT 1 FROM dbo.integration_account_state WITH(UPDLOCK,HOLDLOCK) WHERE singleton=1 AND version=${Number(snapshot.version)}) THROW 51001,'Account state changed. Retry import offline.',1;`;
    sql += `IF (SELECT COUNT(*) FROM dbo.ban_be WITH(UPDLOCK,HOLDLOCK))<>${relations.length} THROW 51003,'Legacy friends changed. Retry import offline.',1;`;
    for (const r of relations) sql += `IF NOT EXISTS(SELECT 1 FROM dbo.ban_be WHERE ma_nguoi_dung_nho=${v(r.lowId)} AND ma_nguoi_dung_lon=${v(r.highId)}) THROW 51003,'Legacy friends changed. Retry import offline.',1;`;
    for (const r of rows) {
      sql += `IF NOT EXISTS(SELECT 1 FROM dbo.nguoi_dung WITH(UPDLOCK,HOLDLOCK) WHERE ma=${v(r.legacyId)} AND mat_khau_bam=${v(r.passwordHash)} AND ten_dang_nhap=${v(r.username)} AND email=${v(r.email)} AND ten_hien_thi=${v(r.displayName)} AND dang_hoat_dong=${v(Boolean(r.active))}) THROW 51002,'Legacy account changed. Retry import offline.',1;
        INSERT dbo.integration_user_map(external_id,user_id) VALUES(${v(map.get(r.legacyId))},${v(r.legacyId)});`;
    }
    for (const r of addedRequests) sql += `IF NOT EXISTS(SELECT 1 FROM dbo.loi_moi_ket_ban WITH(UPDLOCK,HOLDLOCK) WHERE ma=${v(r.legacyId)} AND ma_nguoi_gui=${v(r.sender)} AND ma_nguoi_nhan=${v(r.recipient)} AND trang_thai=${v(r.status)}) THROW 51004,'Legacy friend request changed. Retry import offline.',1;
      INSERT dbo.integration_friend_request_map(external_id,request_id) VALUES(${v(r.externalId)},${v(r.legacyId)});`;
    sql += `UPDATE dbo.integration_account_state SET payload=${v(JSON.stringify(state))},version=version+1 WHERE singleton=1;`;
    await db.execute(`BEGIN TRY BEGIN TRANSACTION; ${sql} COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;`);
    return { ...summary, applied: true };
  } finally { await db.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(await importPhase1Accounts({ apply: process.argv.includes('--apply'), serverStopped: process.argv.includes('--server-stopped'),
      onlyUserIds: process.argv.filter((a) => a.startsWith('--user-id=')).map((a) => a.slice('--user-id='.length)) }));
  } catch { console.error('Legacy import failed. No import transaction was committed. Check schema/conflicts and stop the application before applying.'); process.exitCode = 1; }
}
