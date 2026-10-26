using System.Text.Json;
using CoTuong.Core.Abstractions;
using CoTuong.Core.Enums;
using CoTuong.Core.Errors;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Infrastructure.Services;

/// <summary>Direct friend invitations into a Room with a server enforced 60 second lifetime.</summary>
public sealed class RoomInvitationService(CoTuongDbContext db, IClock clock, IRoomLockProvider locks, IRealtimeNotifier notifier)
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(60);

    public async Task<long> SendAsync(long hostId, long roomId, long friendId, CancellationToken ct = default)
    {
        if (hostId == friendId) throw new BusinessException(BusinessErrorCode.ThaoTacKhongHopLe);
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var room = await db.phongs.SingleOrDefaultAsync(x => x.ma == roomId && x.trang_thai != TrangThaiPhong.Closed, ct)
            ?? throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        if (!await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == hostId
            && x.vai_tro == VaiTro.Host && x.thoi_diem_roi == null, ct))
            throw new BusinessException(BusinessErrorCode.KhongPhaiChuRoom);

        var now = clock.UtcNow;
        var pendingInvites = await db.loi_moi_vao_phongs.Where(x => x.ma_nguoi_moi == hostId && x.trang_thai == TrangThaiLoiMoiVaoPhong.Pending).ToListAsync(ct);
        foreach (var stale in pendingInvites.Where(x => x.thoi_diem_het_han <= now))
        {
            stale.trang_thai = TrangThaiLoiMoiVaoPhong.Expired;
            stale.thoi_diem_phan_hoi = now;
            AddNotification(stale.ma_nguoi_duoc_moi, TrangThaiThongBao.RoomInvitationExpired, hostId, stale.ma, roomId);
        }
        if (pendingInvites.Any(x => x.thoi_diem_het_han > now))
            throw new BusinessException(BusinessErrorCode.DaCoLoiMoiDangChoPhanHoi);

        var low = Math.Min(hostId, friendId);
        var high = Math.Max(hostId, friendId);
        if (!await db.ban_bes.AnyAsync(x => x.ma_nguoi_dung_nho == low && x.ma_nguoi_dung_lon == high, ct))
            throw new BusinessException(BusinessErrorCode.KhongPhaiBanBe);
        var friendOnline = await db.v_nguoi_dung_onlines.AnyAsync(x => x.ma_nguoi_dung == friendId && x.dang_online == true, ct);
        if (!friendOnline) throw new BusinessException(BusinessErrorCode.NguoiChoiDangOffline);

        var invite = new loi_moi_vao_phong
        {
            ma_phong = roomId,
            ma_nguoi_moi = hostId,
            ma_nguoi_duoc_moi = friendId,
            trang_thai = TrangThaiLoiMoiVaoPhong.Pending,
            thoi_diem_gui = now,
            thoi_diem_het_han = now.Add(Lifetime)
        };
        db.loi_moi_vao_phongs.Add(invite);
        await db.SaveChangesAsync(ct);
        AddNotification(friendId, TrangThaiThongBao.RoomInvitationReceived, hostId, invite.ma, roomId,
            JsonSerializer.Serialize(new { tenRoom = room.ten }));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.UserAsync(friendId, RealtimeEvent.InviteReceived, new
        {
            inviteId = invite.ma, roomId, roomName = room.ten, hostId,
            expiresAtUtc = invite.thoi_diem_het_han
        }, ct);
        return invite.ma;
    }

    public async Task RespondAsync(long inviteeId, long inviteId, bool accept, CancellationToken ct = default)
    {
        var roomId = await db.loi_moi_vao_phongs.AsNoTracking().Where(x => x.ma == inviteId)
            .Select(x => (long?)x.ma_phong).SingleOrDefaultAsync(ct)
            ?? throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var invite = await db.loi_moi_vao_phongs.Include(x => x.ma_phongNavigation)
            .SingleOrDefaultAsync(x => x.ma == inviteId, ct)
            ?? throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        if (invite.ma_nguoi_duoc_moi != inviteeId) throw new BusinessException(BusinessErrorCode.KhongDuQuyen);
        if (invite.trang_thai != TrangThaiLoiMoiVaoPhong.Pending) throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);

        var now = clock.UtcNow;
        var hostStillPresent = await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId
            && x.ma_nguoi_dung == invite.ma_nguoi_moi && x.vai_tro == VaiTro.Host && x.thoi_diem_roi == null, ct);
        if (!hostStillPresent)
        {
            invite.trang_thai = TrangThaiLoiMoiVaoPhong.Invalidated;
            invite.thoi_diem_phan_hoi = now;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        }
        if (invite.thoi_diem_het_han <= now)
        {
            invite.trang_thai = TrangThaiLoiMoiVaoPhong.Expired;
            invite.thoi_diem_phan_hoi = now;
            AddNotification(invite.ma_nguoi_moi, TrangThaiThongBao.RoomInvitationExpired, inviteeId, invite.ma, roomId);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await NotifyUpdatedAsync(invite, ct);
            throw new BusinessException(BusinessErrorCode.LoiMoiVaoRoomHetHan);
        }

        if (invite.ma_phongNavigation.trang_thai == TrangThaiPhong.Closed)
        {
            invite.trang_thai = TrangThaiLoiMoiVaoPhong.Invalidated;
            invite.thoi_diem_phan_hoi = now;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            throw new BusinessException(BusinessErrorCode.RoomKhongConKhaDung);
        }

        invite.trang_thai = accept ? TrangThaiLoiMoiVaoPhong.Completed : TrangThaiLoiMoiVaoPhong.Declined;
        invite.thoi_diem_phan_hoi = now;
        if (accept)
        {
            var room = invite.ma_phongNavigation;
            if (await db.cam_vao_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == inviteeId, ct))
                throw new BusinessException(BusinessErrorCode.DaBiDaKhoiPhong);
            var existing = await db.thanh_vien_phongs.SingleOrDefaultAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == inviteeId && x.thoi_diem_roi == null, ct);
            if (existing is null)
            {
                var members = await db.thanh_vien_phongs.Where(x => x.ma_phong == roomId && x.thoi_diem_roi == null).ToListAsync(ct);
                var hasActiveMatch = await db.tran_daus.AnyAsync(x => x.ma_phong == roomId && x.trang_thai != "Finished", ct);
                var role = !hasActiveMatch && members.All(x => x.vai_tro != VaiTro.Opponent)
                    ? VaiTro.Opponent : VaiTro.Spectator;
                if (role == VaiTro.Spectator && members.Count(x => x.vai_tro == VaiTro.Spectator) >= room.so_khan_gia_toi_da)
                    throw new BusinessException(BusinessErrorCode.PhongDaDay);
                db.thanh_vien_phongs.Add(new thanh_vien_phong
                {
                    ma_phong = roomId, ma_nguoi_dung = inviteeId, vai_tro = role, san_sang = false,
                    thoi_diem_vao = now, thoi_diem_nhan_vai_tro = now, nguon_tham_gia = "Invite"
                });
                db.su_kien_thanh_vien_phongs.Add(new su_kien_thanh_vien_phong
                {
                    ma_phong = roomId, ma_nguoi_dung = inviteeId, ma_nguoi_thuc_hien = inviteeId,
                    loai_su_kien = LoaiSuKienThanhVien.Joined, vai_tro_moi = role, ngay_tao = now
                });
                if (role == VaiTro.Opponent) room.trang_thai = TrangThaiPhong.Full;
            }
        }
        else
        {
            AddNotification(invite.ma_nguoi_moi, TrangThaiThongBao.RoomInvitationDeclined, inviteeId, invite.ma, roomId);
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await NotifyUpdatedAsync(invite, ct);
        if (accept)
        {
            await notifier.RoomAsync(roomId, RealtimeEvent.MemberJoined, new { userId = inviteeId }, ct);
            await notifier.PublicRoomsChangedAsync(ct);
        }
    }

    public async Task CancelAsync(long hostId, long inviteId, CancellationToken ct = default)
    {
        var roomId = await db.loi_moi_vao_phongs.AsNoTracking().Where(x => x.ma == inviteId)
            .Select(x => (long?)x.ma_phong).SingleOrDefaultAsync(ct)
            ?? throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        await using var roomLock = await locks.AcquireAsync(roomId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var invite = await db.loi_moi_vao_phongs.SingleOrDefaultAsync(x => x.ma == inviteId, ct)
            ?? throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        if (invite.ma_nguoi_moi != hostId) throw new BusinessException(BusinessErrorCode.KhongDuQuyen);
        if (!await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId && x.ma_nguoi_dung == hostId
            && x.vai_tro == VaiTro.Host && x.thoi_diem_roi == null, ct))
            throw new BusinessException(BusinessErrorCode.KhongPhaiChuRoom);
        if (invite.trang_thai != TrangThaiLoiMoiVaoPhong.Pending) throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        invite.trang_thai = TrangThaiLoiMoiVaoPhong.Cancelled;
        invite.thoi_diem_phan_hoi = clock.UtcNow;
        AddNotification(invite.ma_nguoi_duoc_moi, TrangThaiThongBao.RoomInvitationCancelled, hostId, invite.ma, invite.ma_phong);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await NotifyUpdatedAsync(invite, ct);
    }

    public async Task<int> ExpireDueAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var inviteIds = await db.loi_moi_vao_phongs.AsNoTracking()
            .Where(x => x.trang_thai == TrangThaiLoiMoiVaoPhong.Pending && x.thoi_diem_het_han <= now)
            .Select(x => new { x.ma, x.ma_phong }).ToListAsync(ct);
        var expiredCount = 0;
        foreach (var pending in inviteIds)
        {
            await using var roomLock = await locks.AcquireAsync(pending.ma_phong, ct);
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var invite = await db.loi_moi_vao_phongs.SingleOrDefaultAsync(x => x.ma == pending.ma
                && x.trang_thai == TrangThaiLoiMoiVaoPhong.Pending && x.thoi_diem_het_han <= now, ct);
            if (invite is null) continue;
            invite.trang_thai = TrangThaiLoiMoiVaoPhong.Expired;
            invite.thoi_diem_phan_hoi = now;
            AddNotification(invite.ma_nguoi_moi, TrangThaiThongBao.RoomInvitationExpired,
                invite.ma_nguoi_duoc_moi, invite.ma, invite.ma_phong);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            expiredCount++;
            await NotifyUpdatedAsync(invite, ct);
        }
        return expiredCount;
    }

    private void AddNotification(long recipient, string type, long? actor, long inviteId, long roomId, string? extra = null) => db.thong_baos.Add(new thong_bao
    {
        ma_nguoi_dung = recipient, loai = type, ma_nguoi_thuc_hien = actor,
        ma_loi_moi_vao_phong = inviteId, ma_phong = roomId, du_lieu_phu = extra,
        ngay_tao = clock.UtcNow
    });

    private async Task NotifyUpdatedAsync(loi_moi_vao_phong invite, CancellationToken ct)
    {
        await notifier.UserAsync(invite.ma_nguoi_moi, RealtimeEvent.InviteUpdated,
            new { inviteId = invite.ma, status = invite.trang_thai, expiresAtUtc = invite.thoi_diem_het_han }, ct);
        await notifier.UserAsync(invite.ma_nguoi_duoc_moi, RealtimeEvent.InviteUpdated,
            new { inviteId = invite.ma, status = invite.trang_thai, expiresAtUtc = invite.thoi_diem_het_han }, ct);
    }
}
