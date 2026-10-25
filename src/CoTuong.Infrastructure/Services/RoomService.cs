using CoTuong.Core.Abstractions;
using CoTuong.Core.Dtos;
using CoTuong.Core.Enums;
using CoTuong.Core.Errors;
using CoTuong.Core.Validation;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CoTuong.Infrastructure.Services;

/// <summary>Core Phase 1 Room creation, discovery, and joining workflows.</summary>
public sealed class RoomService(CoTuongDbContext db, IClock clock, IRoomLockProvider locks, IRealtimeNotifier notifier)
{
    public async Task<CreateRoomResult> CreateAsync(long hostId, CreateRoomRequest request, string? idempotencyKey = null, CancellationToken ct = default)
    {
        if (!TenPhongValidator.IsValid(request.TenPhong)) throw new BusinessException(BusinessErrorCode.TenRoomKhongHopLe);
        if (request.CheDoHienThi is not (CheDoHienThi.Public or CheDoHienThi.Private))
            throw new BusinessException(BusinessErrorCode.ThaoTacKhongHopLe);
        if (!await db.nguoi_dungs.AnyAsync(x => x.ma == hostId && x.dang_hoat_dong, ct))
            throw new BusinessException(BusinessErrorCode.KhongTimThayDuLieu);

        idempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? Guid.NewGuid().ToString("N") : idempotencyKey.Trim();
        if (idempotencyKey.Length > 64) throw new BusinessException(BusinessErrorCode.ThaoTacKhongHopLe);

        var prior = await GetCreateResultAsync(hostId, idempotencyKey, ct);
        if (prior is not null) return prior;

        for (var attempt = 0; attempt < 5; attempt++)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var now = clock.UtcNow;
            var idempotency = new yeu_cau_chong_lap
            {
                ma_nguoi_dung = hostId,
                loai_yeu_cau = LoaiYeuCauChongLap.CreateRoom,
                khoa_idempotency = idempotencyKey,
                ngay_tao = now
            };
            db.yeu_cau_chong_laps.Add(idempotency);
            var room = new phong
            {
                ma_so_phong = TokenGenerator.GenerateRoomCode(),
                token_moi = TokenGenerator.GenerateOpaqueToken(16),
                ten = request.TenPhong.Trim(),
                che_do_hien_thi = request.CheDoHienThi,
                trang_thai = TrangThaiPhong.WaitingOpponent,
                so_khan_gia_toi_da = 10,
                ma_nguoi_tao = hostId,
                ngay_tao = now
            };
            db.phongs.Add(room);
            try
            {
                await db.SaveChangesAsync(ct);
                db.thanh_vien_phongs.Add(new thanh_vien_phong
                {
                    ma_phong = room.ma,
                    ma_nguoi_dung = hostId,
                    vai_tro = VaiTro.Host,
                    san_sang = false,
                    thoi_diem_vao = now,
                    thoi_diem_nhan_vai_tro = now,
                    nguon_tham_gia = "Create"
                });
                AddMemberEvent(room.ma, hostId, hostId, LoaiSuKienThanhVien.RoomCreated, null, VaiTro.Host);
                await db.SaveChangesAsync(ct);
                var result = new CreateRoomResult(room.ma, room.ma_so_phong, room.token_moi, room.ten, room.che_do_hien_thi, room.trang_thai);
                idempotency.ket_qua_bam = JsonSerializer.Serialize(result);
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                await notifier.PublicRoomsChangedAsync(ct);
                await notifier.RoomAsync(room.ma, RealtimeEvent.RoomStateChanged, new { roomId = room.ma, status = room.trang_thai }, ct);
                return result;
            }
            catch (DbUpdateException exception)
            {
                await tx.RollbackAsync(ct);
                await tx.DisposeAsync();
                db.ChangeTracker.Clear();
                prior = await GetCreateResultAsync(hostId, idempotencyKey, ct);
                if (prior is not null) return prior;
                var sqlError = exception.GetBaseException() as SqlException;
                if (sqlError is null || sqlError.Number is not (2601 or 2627) || attempt == 4) throw;
            }
        }

        throw new BusinessException(BusinessErrorCode.ThaoTacKhongHopLe);
    }

    private async Task<CreateRoomResult?> GetCreateResultAsync(long userId, string key, CancellationToken ct)
    {
        var json = await db.yeu_cau_chong_laps.AsNoTracking()
            .Where(x => x.ma_nguoi_dung == userId && x.loai_yeu_cau == LoaiYeuCauChongLap.CreateRoom && x.khoa_idempotency == key)
            .Select(x => x.ket_qua_bam).SingleOrDefaultAsync(ct);
        return json is null ? null : JsonSerializer.Deserialize<CreateRoomResult>(json);
    }

    public async Task<IReadOnlyList<RoomCongKhaiItem>> ListPublicAsync(CancellationToken ct = default)
    {
        var rooms = await db.phongs.AsNoTracking().Where(x => x.che_do_hien_thi == CheDoHienThi.Public && x.trang_thai != TrangThaiPhong.Closed)
            .OrderByDescending(x => x.ngay_tao)
            .Select(x => new
            {
                x.ma, x.ten, x.trang_thai,
                Host = db.thanh_vien_phongs.Where(m => m.ma_phong == x.ma && m.vai_tro == VaiTro.Host && m.thoi_diem_roi == null)
                    .Select(m => m.ma_nguoi_dungNavigation.ten_hien_thi).FirstOrDefault(),
                x.so_khan_gia_toi_da
            }).ToListAsync(ct);
        var ids = rooms.Select(x => x.ma).ToArray();
        var counts = await db.thanh_vien_phongs.AsNoTracking().Where(x => ids.Contains(x.ma_phong) && x.thoi_diem_roi == null && x.vai_tro == VaiTro.Spectator)
            .GroupBy(x => x.ma_phong).Select(g => new { RoomId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.RoomId, x => x.Count, ct);
        return rooms.Select(x => new RoomCongKhaiItem(x.ma, x.ten, x.Host ?? "", x.trang_thai, counts.GetValueOrDefault(x.ma), x.so_khan_gia_toi_da, CheDoHienThi.Public)).ToArray();
    }

    public Task<RoomSnapshot> JoinByCodeAsync(long userId, string code, CancellationToken ct = default)
    {
        if (!MaPhongValidator.IsValid(code)) throw new BusinessException(BusinessErrorCode.MaRoomKhongHopLe);
        return JoinAsync(userId, q => q.Where(x => x.ma_so_phong == code.Trim()), "Code", ct);
    }

    public Task<RoomSnapshot> JoinByInviteTokenAsync(long userId, string token, CancellationToken ct = default) =>
        JoinAsync(userId, q => q.Where(x => x.token_moi == token), "Link", ct);

    public Task<RoomSnapshot> JoinPublicAsync(long userId, long roomId, CancellationToken ct = default) =>
        JoinAsync(userId, q => q.Where(x => x.ma == roomId && x.che_do_hien_thi == CheDoHienThi.Public), "PublicList", ct);

    public async Task<RoomSnapshot> GetSnapshotAsync(long roomId, long viewerId, CancellationToken ct = default)
    {
        var room = await db.phongs.AsNoTracking().SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        var isMember = await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == viewerId && x.thoi_diem_roi == null, ct);
        if (!isMember) throw new BusinessException(BusinessErrorCode.KhongDuQuyen);
        return await SnapshotAsync(room, viewerId, ct);
    }

    public async Task SetReadyAsync(long roomId, long userId, bool ready, CancellationToken ct = default)
    {
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (await db.tran_daus.AnyAsync(x => x.ma_phong == roomId && x.trang_thai != "Finished", ct))
            throw new BusinessException(BusinessErrorCode.RoomDaCoMatch);
        var member = await db.thanh_vien_phongs.SingleOrDefaultAsync(x => x.ma_phong == roomId
            && x.ma_nguoi_dung == userId && x.thoi_diem_roi == null, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongDuQuyen);
        if (member.vai_tro is not (VaiTro.Host or VaiTro.Opponent))
            throw new BusinessException(BusinessErrorCode.KhongDuQuyen);

        member.san_sang = ready;
        member.thoi_diem_san_sang = ready ? clock.UtcNow : null;
        AddMemberEvent(roomId, userId, userId, LoaiSuKienThanhVien.ReadyChanged, member.vai_tro, member.vai_tro);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.RoomAsync(roomId, RealtimeEvent.ReadyChanged, new { userId, ready }, ct);
        await notifier.RoomAsync(roomId, RealtimeEvent.RoomStateChanged, new { roomId }, ct);
    }

    public async Task<long> StartMatchAsync(long roomId, long hostId, CancellationToken ct = default)
    {
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (!await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == hostId
            && x.vai_tro == VaiTro.Host && x.thoi_diem_roi == null, ct))
            throw new BusinessException(BusinessErrorCode.KhongPhaiChuRoom);

        var existingMatch = await db.tran_daus.Where(x => x.ma_phong == roomId && x.trang_thai != "Finished")
            .Select(x => (long?)x.ma).SingleOrDefaultAsync(ct);
        if (existingMatch is not null)
        {
            await tx.CommitAsync(ct);
            return existingMatch.Value;
        }

        var players = await db.thanh_vien_phongs.Where(x => x.ma_phong == roomId && x.thoi_diem_roi == null
            && (x.vai_tro == VaiTro.Host || x.vai_tro == VaiTro.Opponent)).ToListAsync(ct);
        var host = players.SingleOrDefault(x => x.vai_tro == VaiTro.Host);
        var opponent = players.SingleOrDefault(x => x.vai_tro == VaiTro.Opponent);
        if (host is null || opponent is null || !host.san_sang || !opponent.san_sang)
            throw new BusinessException(BusinessErrorCode.ChuaSanSang);

        var now = clock.UtcNow;
        var match = new tran_dau
        {
            loai_tran = "PvP", ma_phong = roomId, ma_nguoi_tao = hostId,
            ma_nguoi_choi_do = host.ma_nguoi_dung, ma_nguoi_choi_den = opponent.ma_nguoi_dung,
            trang_thai = "Countdown", ben_den_luot = "Red", so_nuoc_di = 0,
            gioi_han_luot_giay = 60, phien_ban_trang_thai = 0, ngay_tao = now,
            thoi_diem_bat_dau_dem_nguoc = now
        };
        db.tran_daus.Add(match);
        await db.SaveChangesAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"EXEC dbo.usp_khoi_tao_quan_co_tran_dau @ma_tran_dau={match.ma}", ct);
        room.trang_thai = TrangThaiPhong.Full;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        await notifier.RoomAsync(roomId, RealtimeEvent.MatchStarted, new { matchId = match.ma, status = match.trang_thai }, ct);
        await notifier.PublicRoomsChangedAsync(ct);
        return match.ma;
    }

    public async Task BecomeOpponentAsync(long roomId, long userId, CancellationToken ct = default)
    {
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (await db.tran_daus.AnyAsync(x => x.ma_phong == roomId && x.trang_thai != "Finished", ct))
            throw new BusinessException(BusinessErrorCode.KhongTheMoVaiTroDoiThu);
        var member = await db.thanh_vien_phongs.SingleOrDefaultAsync(x => x.ma_phong == roomId
            && x.ma_nguoi_dung == userId && x.thoi_diem_roi == null, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongDuQuyen);
        if (member.vai_tro != VaiTro.Spectator) throw new BusinessException(BusinessErrorCode.KhongTheMoVaiTroDoiThu);
        if (await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId && x.vai_tro == VaiTro.Opponent && x.thoi_diem_roi == null, ct))
            throw new BusinessException(BusinessErrorCode.ODoiThuDaCoNguoi);

        member.vai_tro = VaiTro.Opponent;
        member.san_sang = false;
        member.thoi_diem_san_sang = null;
        member.thoi_diem_nhan_vai_tro = clock.UtcNow;
        room.trang_thai = TrangThaiPhong.Full;
        AddMemberEvent(roomId, userId, userId, LoaiSuKienThanhVien.BecameOpponent, VaiTro.Spectator, VaiTro.Opponent);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.RoomAsync(roomId, RealtimeEvent.RoleChanged, new { userId, role = VaiTro.Opponent }, ct);
        await notifier.PublicRoomsChangedAsync(ct);
    }

    public async Task RemoveOpponentAsync(long roomId, long hostId, CancellationToken ct = default)
    {
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (!await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == hostId
            && x.vai_tro == VaiTro.Host && x.thoi_diem_roi == null, ct))
            throw new BusinessException(BusinessErrorCode.KhongPhaiChuRoom);
        if (await db.tran_daus.AnyAsync(x => x.ma_phong == roomId && x.trang_thai != "Finished", ct))
            throw new BusinessException(BusinessErrorCode.KhongTheMoVaiTroDoiThu);
        var opponent = await db.thanh_vien_phongs.SingleOrDefaultAsync(x => x.ma_phong == roomId
            && x.vai_tro == VaiTro.Opponent && x.thoi_diem_roi == null, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongTimThayDuLieu);
        opponent.vai_tro = VaiTro.Spectator;
        opponent.san_sang = false;
        opponent.thoi_diem_san_sang = null;
        opponent.thoi_diem_nhan_vai_tro = clock.UtcNow;
        room.trang_thai = TrangThaiPhong.WaitingOpponent;
        AddMemberEvent(roomId, opponent.ma_nguoi_dung, hostId, LoaiSuKienThanhVien.RemovedFromOpponent, VaiTro.Opponent, VaiTro.Spectator);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.RoomAsync(roomId, RealtimeEvent.RoleChanged, new { userId = opponent.ma_nguoi_dung, role = VaiTro.Spectator }, ct);
        await notifier.PublicRoomsChangedAsync(ct);
    }

    public async Task LeaveAsync(long roomId, long userId, CancellationToken ct = default)
    {
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (await db.tran_daus.AnyAsync(x => x.ma_phong == roomId && x.trang_thai != "Finished", ct))
            throw new BusinessException(BusinessErrorCode.RoomDaCoMatch);
        var leaving = await db.thanh_vien_phongs.SingleOrDefaultAsync(x => x.ma_phong == roomId
            && x.ma_nguoi_dung == userId && x.thoi_diem_roi == null, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongDuQuyen);
        var oldRole = leaving.vai_tro;
        var now = clock.UtcNow;
        long? transferredHostId = null;

        if (oldRole == VaiTro.Host)
        {
            var others = await db.thanh_vien_phongs.Where(x => x.ma_phong == roomId && x.ma_nguoi_dung != userId && x.thoi_diem_roi == null)
                .OrderBy(x => x.vai_tro == VaiTro.Opponent ? 0 : 1).ThenBy(x => x.thoi_diem_vao).ToListAsync(ct);
            var nextHost = others.FirstOrDefault();
            if (nextHost is not null)
            {
                transferredHostId = nextHost.ma_nguoi_dung;
                var previousRole = nextHost.vai_tro;
                nextHost.vai_tro = VaiTro.Host;
                nextHost.san_sang = false;
                nextHost.thoi_diem_san_sang = null;
                nextHost.thoi_diem_nhan_vai_tro = now;
                AddMemberEvent(roomId, nextHost.ma_nguoi_dung, userId, LoaiSuKienThanhVien.HostTransferred, previousRole, VaiTro.Host);
                foreach (var other in others.Where(x => x.ma != nextHost.ma))
                {
                    other.san_sang = false;
                    other.thoi_diem_san_sang = null;
                }
                room.trang_thai = others.Any(x => x.ma != nextHost.ma && x.vai_tro == VaiTro.Opponent)
                    ? TrangThaiPhong.Full : TrangThaiPhong.WaitingOpponent;
            }
            else
            {
                room.trang_thai = TrangThaiPhong.Closed;
                room.thoi_diem_dong = now;
            }

            var pending = await db.loi_moi_vao_phongs.Where(x => x.ma_phong == roomId && x.ma_nguoi_moi == userId
                && x.trang_thai == TrangThaiLoiMoiVaoPhong.Pending).ToListAsync(ct);
            foreach (var invite in pending)
            {
                invite.trang_thai = TrangThaiLoiMoiVaoPhong.Invalidated;
                invite.thoi_diem_phan_hoi = now;
            }
        }
        else if (oldRole == VaiTro.Opponent)
        {
            room.trang_thai = TrangThaiPhong.WaitingOpponent;
        }

        leaving.thoi_diem_roi = now;
        leaving.ly_do_roi = "Left";
        leaving.san_sang = false;
        leaving.thoi_diem_san_sang = null;
        AddMemberEvent(roomId, userId, userId, LoaiSuKienThanhVien.Left, oldRole, null);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.RoomAsync(roomId, RealtimeEvent.MemberLeft, new { userId, oldRole }, ct);
        if (room.trang_thai == TrangThaiPhong.Closed)
            await notifier.RoomAsync(roomId, RealtimeEvent.RoomClosed, new { roomId }, ct);
        else if (oldRole == VaiTro.Host)
            await notifier.RoomAsync(roomId, RealtimeEvent.HostTransferred, new { userId = transferredHostId }, ct);
        await notifier.PublicRoomsChangedAsync(ct);
    }

    public async Task KickAsync(long roomId, long hostId, long targetUserId, CancellationToken ct = default)
    {
        if (hostId == targetUserId) throw new BusinessException(BusinessErrorCode.ThaoTacKhongHopLe);
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (!await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == hostId
            && x.vai_tro == VaiTro.Host && x.thoi_diem_roi == null, ct))
            throw new BusinessException(BusinessErrorCode.KhongPhaiChuRoom);
        if (await db.tran_daus.AnyAsync(x => x.ma_phong == roomId && x.trang_thai != "Finished", ct))
            throw new BusinessException(BusinessErrorCode.RoomDaCoMatch);
        var target = await db.thanh_vien_phongs.SingleOrDefaultAsync(x => x.ma_phong == roomId
            && x.ma_nguoi_dung == targetUserId && x.thoi_diem_roi == null, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongTimThayDuLieu);

        var now = clock.UtcNow;
        var oldRole = target.vai_tro;
        target.thoi_diem_roi = now;
        target.ly_do_roi = "Kicked";
        target.san_sang = false;
        target.thoi_diem_san_sang = null;
        if (oldRole == VaiTro.Opponent) room.trang_thai = TrangThaiPhong.WaitingOpponent;
        db.cam_vao_phongs.Add(new cam_vao_phong
        {
            ma_phong = roomId, ma_nguoi_dung = targetUserId, ma_nguoi_cam = hostId, thoi_diem_bi_cam = now
        });
        AddMemberEvent(roomId, targetUserId, hostId, LoaiSuKienThanhVien.Kicked, oldRole, null);
        var pending = await db.loi_moi_vao_phongs.Where(x => x.ma_phong == roomId && x.ma_nguoi_duoc_moi == targetUserId
            && x.trang_thai == TrangThaiLoiMoiVaoPhong.Pending).ToListAsync(ct);
        foreach (var invite in pending)
        {
            invite.trang_thai = TrangThaiLoiMoiVaoPhong.Invalidated;
            invite.thoi_diem_phan_hoi = now;
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.RoomAsync(roomId, RealtimeEvent.MemberLeft, new { userId = targetUserId, role = oldRole, kicked = true }, ct);
        await notifier.PublicRoomsChangedAsync(ct);
    }

    private async Task<RoomSnapshot> JoinAsync(long userId, Func<IQueryable<phong>, IQueryable<phong>> filter, string source, CancellationToken ct)
    {
        var roomId = await filter(db.phongs.AsNoTracking()).Select(x => (long?)x.ma).SingleOrDefaultAsync(ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (!await db.nguoi_dungs.AnyAsync(x => x.ma == userId && x.dang_hoat_dong, ct))
            throw new BusinessException(BusinessErrorCode.KhongTimThayDuLieu);
        if (await db.cam_vao_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == userId, ct))
            throw new BusinessException(BusinessErrorCode.DaBiDaKhoiPhong);

        var member = await db.thanh_vien_phongs.SingleOrDefaultAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == userId && x.thoi_diem_roi == null, ct);
        if (member is null)
        {
            var members = await db.thanh_vien_phongs.Where(x => x.ma_phong == roomId && x.thoi_diem_roi == null).ToListAsync(ct);
            var hasActiveMatch = await db.tran_daus.AnyAsync(x => x.ma_phong == roomId && x.trang_thai != "Finished", ct);
            var role = !hasActiveMatch && members.All(x => x.vai_tro != VaiTro.Opponent)
                && room.trang_thai is TrangThaiPhong.WaitingOpponent or TrangThaiPhong.WaitingNewMatch
                ? VaiTro.Opponent : VaiTro.Spectator;
            if (role == VaiTro.Spectator && members.Count(x => x.vai_tro == VaiTro.Spectator) >= room.so_khan_gia_toi_da)
                throw new BusinessException(BusinessErrorCode.PhongDaDay);

            var now = clock.UtcNow;
            member = new thanh_vien_phong
            {
                ma_phong = roomId, ma_nguoi_dung = userId, vai_tro = role,
                san_sang = false, thoi_diem_vao = now, thoi_diem_nhan_vai_tro = now, nguon_tham_gia = source
            };
            db.thanh_vien_phongs.Add(member);
            AddMemberEvent(roomId, userId, userId, LoaiSuKienThanhVien.Joined, null, role);
            if (role == VaiTro.Opponent) room.trang_thai = TrangThaiPhong.Full;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await notifier.RoomAsync(roomId, RealtimeEvent.MemberJoined, new { userId, role }, ct);
            await notifier.PublicRoomsChangedAsync(ct);
        }
        else
        {
            await tx.CommitAsync(ct);
        }

        return await SnapshotAsync(room, userId, ct);
    }

    private async Task<RoomSnapshot> SnapshotAsync(phong room, long? viewerId, CancellationToken ct)
    {
        var members = await db.thanh_vien_phongs.AsNoTracking().Where(x => x.ma_phong == room.ma && x.thoi_diem_roi == null)
            .Select(x => new { x.ma_nguoi_dung, x.vai_tro, x.san_sang, x.thoi_diem_vao, x.ma_nguoi_dungNavigation.ten_hien_thi, x.ma_nguoi_dungNavigation.ten_dang_nhap })
            .OrderBy(x => x.thoi_diem_vao).ToListAsync(ct);
        var host = members.Single(x => x.vai_tro == VaiTro.Host);
        var opponent = members.SingleOrDefault(x => x.vai_tro == VaiTro.Opponent);
        var spectators = members.Where(x => x.vai_tro == VaiTro.Spectator)
            .Select(x => new KhanGiaItem(x.ma_nguoi_dung, x.ten_hien_thi, x.ten_dang_nhap, x.thoi_diem_vao)).ToArray();
        LoiMoiVaoPhongSnapshot? invite = null;
        if (viewerId == host.ma_nguoi_dung)
        {
            var pending = await db.loi_moi_vao_phongs.AsNoTracking()
                .Where(x => x.ma_nguoi_moi == host.ma_nguoi_dung && x.trang_thai == TrangThaiLoiMoiVaoPhong.Pending)
                .Select(x => new LoiMoiVaoPhongSnapshot(x.ma, x.ma_nguoi_duoc_moi,
                    x.ma_nguoi_duoc_moiNavigation.ten_hien_thi, x.thoi_diem_gui, x.thoi_diem_het_han, x.trang_thai))
                .SingleOrDefaultAsync(ct);
            invite = pending;
        }
        return new RoomSnapshot(room.ma, room.ma_so_phong.Trim(), room.token_moi, room.ten, room.che_do_hien_thi, room.trang_thai,
            room.so_khan_gia_toi_da, host.ma_nguoi_dung, host.ten_hien_thi, host.san_sang,
            opponent?.ma_nguoi_dung, opponent?.ten_hien_thi, opponent?.san_sang ?? false, spectators, invite, clock.UtcNow);
    }

    private void AddMemberEvent(long roomId, long userId, long? actorId, string eventType, string? oldRole, string? newRole) =>
        db.su_kien_thanh_vien_phongs.Add(new su_kien_thanh_vien_phong
        {
            ma_phong = roomId, ma_nguoi_dung = userId, ma_nguoi_thuc_hien = actorId,
            loai_su_kien = eventType, vai_tro_cu = oldRole, vai_tro_moi = newRole, ngay_tao = clock.UtcNow
        });
}
