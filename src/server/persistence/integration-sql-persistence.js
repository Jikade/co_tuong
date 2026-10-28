import { readFile } from 'node:fs/promises';
import { createSqlConnection, sqlValue as v, sqlDate as dt } from './sql-connection.js';
import { readSqlConfig } from '../config.js';

const uid = (id) => `(SELECT user_id FROM dbo.integration_user_map WHERE external_id=${v(id)})`;
const side = (s) => s === 'red' ? 'Red' : 'Black';
const types = { king: 'General', advisor: 'Advisor', elephant: 'Elephant', horse: 'Horse', rook: 'Chariot', cannon: 'Cannon', pawn: 'Soldier' };
const outcomes = { 'red-win': 'RedWin', 'black-win': 'BlackWin', draw: 'Draw', voided: 'Voided' };
const reasons = { checkmate: 'Checkmate', 'no-legal-moves': 'NoLegalMove', timeout: 'Timeout', 'left-match': 'LeftMatch', 'disconnect-timeout': 'DisconnectTimeout', surrender: 'Surrender', 'draw-agreed': 'DrawAgreed', 'system-error': 'SystemError' };
const statuses = { syncing: 'Countdown', countdown: 'Countdown', playing: 'InProgress', paused: 'PausedReconnect', finished: 'Finished' };

function projectMatch(record, suffix, archived = false, roomVariable = 'NULL') {
  const key = v(record.id);
  const m = `@match${suffix}`;
  const red = uid(record.players?.red?.id ?? record.redPlayerId);
  const black = uid(record.players?.black?.id ?? record.blackPlayerId);
  const computer = record.mode === 'computer';
  const creator = computer ? uid(record.humanPlayerId) : red;
  const result = record.result;
  const status = result ? 'Finished' : statuses[record.status] || 'InProgress';
  const initial = record.initialPieces || [];
  const pieces = record.finalPieces ?? record.pieces ?? [];
  const moves = record.moves ?? record.history ?? [];
  const number = (id) => { const i = initial.findIndex((p) => p.id === id); return i < 0 ? null : i + 1; };
  let sql = `DECLARE ${m} bigint=(SELECT match_id FROM dbo.integration_match_state WHERE external_id=${key});
    IF ${m} IS NULL BEGIN
      INSERT dbo.tran_dau(loai_tran,ma_phong,ma_nguoi_tao,ma_nguoi_choi_do,ma_nguoi_choi_den,ben_cua_may)
      VALUES(${v(computer ? 'PvE' : 'PvP')},${roomVariable},${creator},${red},${black},${v(computer ? side(record.computerSide) : null)});
      SET ${m}=SCOPE_IDENTITY();
      INSERT dbo.integration_match_state(external_id,match_id,archived,payload) VALUES(${key},${m},0,N'{}');
    END;
    UPDATE dbo.tran_dau SET trang_thai=${v(status)},ben_den_luot=${v(side(record.currentSide || 'red'))},
      so_nuoc_di=${moves.length},ben_bi_chieu=${v(record.inCheck ? side(record.currentSide) : null)},
      phien_ban_trang_thai=phien_ban_trang_thai+1,
      thoi_gian_con_lai_ms=${Math.max(0, Math.round(record.pausedRemainingMs ?? (record.timeRemaining || 0) * 1000))},
      ket_qua=${v(result ? outcomes[result.outcome] : null)},ly_do_ket_thuc=${v(result ? reasons[result.reason] : null)},
      thoi_diem_bat_dau=${dt(record.startedAt)},thoi_diem_ket_thuc=${dt(result?.endedAt ?? record.endedAt)},
      thoi_diem_nuoc_di_cuoi=${dt(moves.at(-1)?.playedAt)} WHERE ma=${m};
  `;
  // Captured pieces first, so their occupied square can be used by the moving piece.
  const ordered = initial.map((p, i) => ({ p, n: i + 1, current: pieces.find((x) => x.id === p.id) })).sort((a, b) => Boolean(a.current) - Boolean(b.current));
  for (const { p, n, current } of ordered) {
    const capturedAt = moves.findIndex((move) => move.capturedPiece?.id === p.id) + 1;
    const fields = `x_hien_tai=${v(current?.x)},y_hien_tai=${v(current?.y)},da_bi_an=${v(!current)},bi_an_o_nuoc_thu=${v(current ? null : capturedAt || 1)}`;
    sql += `IF EXISTS(SELECT 1 FROM dbo.quan_co_tran_dau WHERE ma_tran_dau=${m} AND so_quan=${n})
      UPDATE dbo.quan_co_tran_dau SET ${fields} WHERE ma_tran_dau=${m} AND so_quan=${n};
      ELSE INSERT dbo.quan_co_tran_dau(ma_tran_dau,so_quan,ben,loai_quan,x_ban_dau,y_ban_dau,x_hien_tai,y_hien_tai,da_bi_an,bi_an_o_nuoc_thu)
      VALUES(${m},${n},${v(side(p.color))},${v(types[p.type])},${p.x},${p.y},${v(current?.x)},${v(current?.y)},${v(!current)},${v(current ? null : capturedAt || 1)});`;
  }
  moves.forEach((move, i) => {
    sql += `IF NOT EXISTS(SELECT 1 FROM dbo.nuoc_di_tran_dau WHERE ma_tran_dau=${m} AND so_thu_tu_nuoc_di=${i + 1})
      INSERT dbo.nuoc_di_tran_dau(ma_tran_dau,so_thu_tu_nuoc_di,ben,ma_nguoi_di,so_quan,tu_x,tu_y,den_x,den_y,so_quan_bi_an,ngay_tao)
      VALUES(${m},${i + 1},${v(side(move.color))},${uid(move.playerId)},${v(number(move.pieceId))},${move.from.x},${move.from.y},${move.to.x},${move.to.y},${v(number(move.capturedPiece?.id))},${dt(move.playedAt)});`;
  });
  sql += `UPDATE dbo.integration_match_state SET payload=CASE WHEN archived=1 AND ${v(!archived)}=1 THEN payload ELSE ${v(JSON.stringify(record))} END,archived=CASE WHEN archived=1 THEN 1 ELSE ${v(archived)} END WHERE external_id=${key};`;
  return sql;
}

function projectRoom(room, i) {
  const key = v(room.id || `legacy-${room.code}`);
  const r = `@room${i}`;
  const status = room.match && ['playing', 'paused', 'countdown', 'syncing'].includes(room.match.status) ? 'InMatch' : room.match?.result ? 'WaitingNewMatch' : room.opponent ? 'Full' : 'WaitingOpponent';
  let sql = `DECLARE ${r} bigint=(SELECT room_id FROM dbo.integration_room_state WHERE external_id=${key});
    IF ${r} IS NULL BEGIN
      INSERT dbo.phong(ma_so_phong,token_moi,ten,che_do_hien_thi,trang_thai,ma_nguoi_tao)
      VALUES(${v(room.code)},REPLACE(CONVERT(char(36),NEWID()),'-',''),${v(room.name)},${v(room.visibility === 'private' ? 'Private' : 'Public')},${v(status)},${uid(room.host.id)});
      SET ${r}=SCOPE_IDENTITY();
      INSERT dbo.integration_room_state(external_id,room_id,active,payload) VALUES(${key},${r},1,N'{}');
    END;
    UPDATE dbo.phong SET ten=${v(room.name)},che_do_hien_thi=${v(room.visibility === 'private' ? 'Private' : 'Public')},trang_thai=${v(status)},thoi_diem_dong=NULL WHERE ma=${r};
    UPDATE dbo.integration_room_state SET active=1,payload=${v(JSON.stringify(room))} WHERE external_id=${key};
    DECLARE @members${i} TABLE(user_id bigint,role varchar(9),ready bit);
  `;
  const members = [{ ...room.host, role: 'Host' }, ...(room.opponent ? [{ ...room.opponent, role: 'Opponent' }] : []), ...room.spectators.map((p) => ({ ...p, role: 'Spectator' }))];
  for (const p of members) sql += `INSERT @members${i} VALUES(${uid(p.id)},${v(p.role)},${v(Boolean(p.ready))});`;
  sql += `UPDATE t SET thoi_diem_roi=SYSUTCDATETIME(),ly_do_roi='Left' FROM dbo.thanh_vien_phong t
    WHERE t.ma_phong=${r} AND t.thoi_diem_roi IS NULL AND NOT EXISTS(SELECT 1 FROM @members${i} m WHERE m.user_id=t.ma_nguoi_dung AND m.role=t.vai_tro);
    UPDATE t SET san_sang=m.ready FROM dbo.thanh_vien_phong t JOIN @members${i} m ON m.user_id=t.ma_nguoi_dung AND m.role=t.vai_tro WHERE t.ma_phong=${r} AND t.thoi_diem_roi IS NULL;
    INSERT dbo.thanh_vien_phong(ma_phong,ma_nguoi_dung,vai_tro,san_sang,nguon_tham_gia)
    SELECT ${r},m.user_id,m.role,m.ready,'Code' FROM @members${i} m WHERE NOT EXISTS(SELECT 1 FROM dbo.thanh_vien_phong t WHERE t.ma_phong=${r} AND t.ma_nguoi_dung=m.user_id AND t.thoi_diem_roi IS NULL);`;
  if (room.match) sql += projectMatch({ ...room.match, players: { red: { id: room.match.redPlayerId, name: members.find((m) => m.id === room.match.redPlayerId)?.name ?? '' }, black: { id: room.match.blackPlayerId, name: members.find((m) => m.id === room.match.blackPlayerId)?.name ?? '' } }, roomCode: room.code, roomName: room.name }, `r${i}`, false, r);
  return sql;
}

export function createIntegrationSqlPersistence({ env = process.env } = {}) {
  const config = readSqlConfig(env);
  const db = createSqlConnection(env);
  let queue = Promise.resolve();
  let version = 0;
  function write(sql) {
    const operation = queue.then(() => db.execute(`BEGIN TRY BEGIN TRANSACTION; ${sql} COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;`));
    queue = operation.catch(() => {});
    return operation;
  }
  return {
    kind: 'sqlserver',
    async init() {
      if (config.autoMigrate) await db.execute(await readFile(new URL('../../../database/03_integration.sql', import.meta.url), 'utf8'));
      await db.execute("IF NOT EXISTS(SELECT 1 FROM dbo.integration_account_state WHERE singleton=1) INSERT dbo.integration_account_state(singleton,payload) VALUES(1,N'{}');");
    },
    accounts: {
      async load() { const [row] = await db.json('SELECT payload,version FROM dbo.integration_account_state WHERE singleton=1'); version = row.version; return JSON.parse(row.payload); },
      async save(state) {
        let sql = `IF NOT EXISTS(SELECT 1 FROM dbo.integration_account_state WITH(UPDLOCK,HOLDLOCK) WHERE singleton=1 AND version=${version}) THROW 51001,'Account state modified by another process. Restart the server.',1;`;
        state.users.forEach((user, i) => {
          sql += `DECLARE @u${i} bigint=${uid(user.id)};
            IF @u${i} IS NULL BEGIN
              INSERT dbo.nguoi_dung(ten_dang_nhap,ten_hien_thi,email,mat_khau_bam) VALUES(${v(user.username)},${v(user.displayName)},${v(user.email)},${v(user.passwordHash)});
              SET @u${i}=SCOPE_IDENTITY(); INSERT dbo.integration_user_map VALUES(${v(user.id)},@u${i});
            END ELSE UPDATE dbo.nguoi_dung SET ten_hien_thi=${v(user.displayName)},mat_khau_bam=${v(user.passwordHash)} WHERE ma=@u${i};`;
        });
        state.sessions.forEach((s, i) => {
          sql += `DECLARE @s${i} bigint=(SELECT session_id FROM dbo.integration_session_map WHERE external_id=${v(s.id)});
            IF @s${i} IS NULL BEGIN INSERT dbo.phien_dang_nhap(ma_nguoi_dung,refresh_token_bam,ngay_tao,thoi_diem_het_han,thoi_diem_thu_hoi)
              VALUES(${uid(s.userId)},${v(s.hash)},${dt(s.createdAt)},${dt(s.expiresAt)},${dt(s.revokedAt)});
              SET @s${i}=SCOPE_IDENTITY(); INSERT dbo.integration_session_map VALUES(${v(s.id)},@s${i});
            END ELSE UPDATE dbo.phien_dang_nhap SET thoi_diem_thu_hoi=${dt(s.revokedAt)} WHERE ma=@s${i};`;
        });
        // Revoke previous reset tokens before inserting a replacement; the base
        // schema permits only one Active token per user, including expired tokens.
        sql += `UPDATE t SET trang_thai='Revoked',thoi_diem_thu_hoi=SYSUTCDATETIME()
          FROM dbo.token_dat_lai_mat_khau t JOIN dbo.integration_reset_map m ON m.reset_id=t.ma WHERE t.trang_thai='Active';`;
        state.resets.forEach((r, i) => {
          const status = r.usedAt ? 'Used' : r.expiresAt <= Date.now() ? 'Expired' : 'Active';
          sql += `DECLARE @reset${i} bigint=(SELECT reset_id FROM dbo.integration_reset_map WHERE hash=${v(r.hash)});
            IF @reset${i} IS NULL BEGIN INSERT dbo.token_dat_lai_mat_khau(ma_nguoi_dung,token_bam,trang_thai,ngay_tao,thoi_diem_het_han,thoi_diem_su_dung)
              VALUES(${uid(r.userId)},${v(r.hash)},${v(status)},${dt(r.createdAt)},${dt(r.expiresAt)},${dt(r.usedAt)});
              SET @reset${i}=SCOPE_IDENTITY(); INSERT dbo.integration_reset_map VALUES(${v(r.hash)},@reset${i});
            END ELSE UPDATE dbo.token_dat_lai_mat_khau SET trang_thai=${v(status)},thoi_diem_su_dung=${dt(r.usedAt)} WHERE ma=@reset${i};`;
        });
        state.friendRequests.forEach((r, i) => {
          const status = r.status === 'Declined' ? 'Rejected' : r.status;
          sql += `DECLARE @friend${i} bigint=(SELECT request_id FROM dbo.integration_friend_request_map WHERE external_id=${v(r.id)});
            IF @friend${i} IS NULL BEGIN INSERT dbo.loi_moi_ket_ban(ma_nguoi_gui,ma_nguoi_nhan,trang_thai)
              VALUES(${uid(r.from)},${uid(r.to)},${v(status)}); SET @friend${i}=SCOPE_IDENTITY();
              INSERT dbo.integration_friend_request_map VALUES(${v(r.id)},@friend${i});
            END ELSE UPDATE dbo.loi_moi_ket_ban SET trang_thai=${v(status)},thoi_diem_phan_hoi=CASE WHEN ${v(status)}='Pending' THEN NULL ELSE COALESCE(thoi_diem_phan_hoi,SYSUTCDATETIME()) END WHERE ma=@friend${i};`;
        });
        sql += `UPDATE dbo.integration_account_state SET payload=${v(JSON.stringify(state))},version=version+1 WHERE singleton=1;`;
        await write(sql);
        version += 1;
      },
    },
    rooms: {
      async loadAll() { return (await db.json('SELECT payload FROM dbo.integration_room_state WHERE active=1')).map((r) => JSON.parse(r.payload)); },
      async saveAll(rooms) {
        let sql = 'UPDATE dbo.integration_room_state SET active=0;';
        rooms.forEach((r, i) => { sql += projectRoom(r, i); });
        sql += `UPDATE p SET trang_thai='Closed',thoi_diem_dong=COALESCE(thoi_diem_dong,SYSUTCDATETIME()) FROM dbo.phong p JOIN dbo.integration_room_state s ON p.ma=s.room_id WHERE s.active=0;
          UPDATE t SET thoi_diem_roi=SYSUTCDATETIME(),ly_do_roi='RoomClosed' FROM dbo.thanh_vien_phong t JOIN dbo.integration_room_state s ON t.ma_phong=s.room_id WHERE s.active=0 AND t.thoi_diem_roi IS NULL;`;
        await write(sql);
      },
    },
    matches: {
      async loadAll() { return (await db.json('SELECT payload FROM dbo.integration_match_state WHERE archived=1')).map((r) => JSON.parse(r.payload)); },
      async upsert(record) {
        const roomId = record.roomCode ? `(SELECT TOP(1) room_id FROM dbo.integration_room_state WHERE JSON_VALUE(payload,'$.code')=${v(record.roomCode)} ORDER BY active DESC)` : 'NULL';
        await write(projectMatch(record, 'single', true, roomId));
        return record;
      },
    },
    async health() { try { await db.execute('SELECT 1;'); return { ok: true, kind: 'sqlserver' }; } catch { return { ok: false, kind: 'sqlserver' }; } },
    async close() { await queue; await db.close(); },
  };
}
