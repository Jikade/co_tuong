using System.Text.Json;
using CoTuong.Core.Abstractions;
using CoTuong.Core.Dtos;
using CoTuong.Core.Enums;
using CoTuong.Core.Errors;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Infrastructure.Services;

/// <summary>Phase 1 friend search, requests, and two-way friendship management.</summary>
public sealed class FriendService(CoTuongDbContext db, IClock clock, IRealtimeNotifier notifier)
{
    public async Task<IReadOnlyList<TimKiemTaiKhoanResult>> SearchAsync(long currentUserId, string query, int take = 20, CancellationToken ct = default)
    {
        var term = query?.Trim();
        if (string.IsNullOrWhiteSpace(term)) return [];
        take = Math.Clamp(take, 1, 50);

        var matches = await db.nguoi_dungs.AsNoTracking()
            .Where(x => x.ma != currentUserId && x.dang_hoat_dong
                && (x.ten_dang_nhap.Contains(term) || x.ten_hien_thi.Contains(term)))
            .OrderBy(x => x.ten_dang_nhap).Take(take)
            .Select(x => new { x.ma, x.ten_dang_nhap, x.ten_hien_thi })
            .ToListAsync(ct);
        var ids = matches.Select(x => x.ma).ToArray();
        var low = Math.Min(currentUserId, ids.DefaultIfEmpty(currentUserId).Min());
        var high = Math.Max(currentUserId, ids.DefaultIfEmpty(currentUserId).Max());
        var friendPairs = await db.ban_bes.AsNoTracking()
            .Where(x => x.ma_nguoi_dung_nho == currentUserId && ids.Contains(x.ma_nguoi_dung_lon)
                || x.ma_nguoi_dung_lon == currentUserId && ids.Contains(x.ma_nguoi_dung_nho))
            .Select(x => new { x.ma_nguoi_dung_nho, x.ma_nguoi_dung_lon }).ToListAsync(ct);
        var pending = await db.loi_moi_ket_bans.AsNoTracking()
            .Where(x => x.trang_thai == TrangThaiLoiMoiKetBan.Pending
                && (x.ma_nguoi_gui == currentUserId && ids.Contains(x.ma_nguoi_nhan)
                    || x.ma_nguoi_nhan == currentUserId && ids.Contains(x.ma_nguoi_gui)))
            .Select(x => new { x.ma_nguoi_gui, x.ma_nguoi_nhan }).ToListAsync(ct);

        return matches.Select(x => new TimKiemTaiKhoanResult(x.ma, x.ten_dang_nhap, x.ten_hien_thi,
            friendPairs.Any(f => f.ma_nguoi_dung_nho == Math.Min(x.ma, currentUserId) && f.ma_nguoi_dung_lon == Math.Max(x.ma, currentUserId))
                ? TrangThaiQuanHe.BanBe
                : pending.Any(p => p.ma_nguoi_gui == x.ma && p.ma_nguoi_nhan == currentUserId || p.ma_nguoi_gui == currentUserId && p.ma_nguoi_nhan == x.ma)
                    ? TrangThaiQuanHe.LoiMoiDangCho : TrangThaiQuanHe.None)).ToArray();
    }

    public async Task<IReadOnlyList<BanBeItem>> ListFriendsAsync(long userId, CancellationToken ct = default)
    {
        var pairs = await db.ban_bes.AsNoTracking().Where(x => x.ma_nguoi_dung_nho == userId || x.ma_nguoi_dung_lon == userId)
            .Select(x => x.ma_nguoi_dung_nho == userId ? x.ma_nguoi_dung_lon : x.ma_nguoi_dung_nho).ToListAsync(ct);
        if (pairs.Count == 0) return [];
        var online = await db.v_nguoi_dung_onlines.AsNoTracking().Where(x => pairs.Contains(x.ma_nguoi_dung) && x.dang_online == true)
            .Select(x => x.ma_nguoi_dung).ToListAsync(ct);
        return await db.nguoi_dungs.AsNoTracking().Where(x => pairs.Contains(x.ma)).OrderBy(x => x.ten_dang_nhap)
            .Select(x => new BanBeItem(x.ma, x.ten_dang_nhap, x.ten_hien_thi, online.Contains(x.ma))).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<LoiMoiKetBanPendingItem>> ListIncomingAsync(long userId, CancellationToken ct = default)
    {
        var pending = await db.loi_moi_ket_bans.AsNoTracking().Where(x => x.ma_nguoi_nhan == userId && x.trang_thai == TrangThaiLoiMoiKetBan.Pending)
            .Select(x => new { x.ma, x.ma_nguoi_gui, x.ngay_tao, x.ma_nguoi_guiNavigation.ten_dang_nhap, x.ma_nguoi_guiNavigation.ten_hien_thi })
            .OrderByDescending(x => x.ngay_tao).ToListAsync(ct);
        var senderIds = pending.Select(x => x.ma_nguoi_gui).ToArray();
        var online = await db.v_nguoi_dung_onlines.AsNoTracking().Where(x => senderIds.Contains(x.ma_nguoi_dung) && x.dang_online == true)
            .Select(x => x.ma_nguoi_dung).ToListAsync(ct);
        return pending.Select(x => new LoiMoiKetBanPendingItem(x.ma, x.ten_dang_nhap, x.ten_hien_thi, online.Contains(x.ma_nguoi_gui), x.ngay_tao)).ToArray();
    }

    public async Task<IReadOnlyList<LoiMoiKetBanSentItem>> ListOutgoingAsync(long userId, CancellationToken ct = default) =>
        await db.loi_moi_ket_bans.AsNoTracking().Where(x => x.ma_nguoi_gui == userId && x.trang_thai == TrangThaiLoiMoiKetBan.Pending)
            .OrderByDescending(x => x.ngay_tao)
            .Select(x => new LoiMoiKetBanSentItem(x.ma, x.ma_nguoi_nhanNavigation.ten_dang_nhap,
                x.ma_nguoi_nhanNavigation.ten_hien_thi, x.ngay_tao)).ToListAsync(ct);

    public async Task<long> SendRequestAsync(long senderId, long recipientId, CancellationToken ct = default)
    {
        if (senderId == recipientId) throw new BusinessException(BusinessErrorCode.KhongTuGuiLoiMoiChoBanThan);
        var recipient = await db.nguoi_dungs.AsNoTracking().SingleOrDefaultAsync(x => x.ma == recipientId && x.dang_hoat_dong, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongTimThayDuLieu);
        var low = Math.Min(senderId, recipientId);
        var high = Math.Max(senderId, recipientId);
        if (await db.ban_bes.AnyAsync(x => x.ma_nguoi_dung_nho == low && x.ma_nguoi_dung_lon == high, ct))
            throw new BusinessException(BusinessErrorCode.DaLaBanBe);

        var existing = await db.loi_moi_ket_bans.SingleOrDefaultAsync(x => x.trang_thai == TrangThaiLoiMoiKetBan.Pending
            && x.ma_nguoi_dung_nho == low && x.ma_nguoi_dung_lon == high, ct);
        if (existing is not null)
        {
            if (existing.ma_nguoi_nhan == senderId)
            {
                await RespondAsync(senderId, existing.ma, accept: true, ct);
                return existing.ma;
            }
            throw new BusinessException(BusinessErrorCode.DaCoLoiMoiDangCho);
        }

        var request = new loi_moi_ket_ban
        {
            ma_nguoi_gui = senderId,
            ma_nguoi_nhan = recipientId,
            ma_nguoi_dung_nho = low,
            ma_nguoi_dung_lon = high,
            trang_thai = TrangThaiLoiMoiKetBan.Pending,
            ngay_tao = clock.UtcNow
        };
        db.loi_moi_ket_bans.Add(request);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            if (await db.loi_moi_ket_bans.AnyAsync(x => x.ma_nguoi_dung_nho == low && x.ma_nguoi_dung_lon == high
                && x.trang_thai == TrangThaiLoiMoiKetBan.Pending, ct))
                throw new BusinessException(BusinessErrorCode.DaCoLoiMoiDangCho);
            throw;
        }
        AddNotification(recipientId, TrangThaiThongBao.FriendRequestReceived, senderId, request.ma);
        await db.SaveChangesAsync(ct);
        await notifier.UserAsync(recipientId, RealtimeEvent.NotificationReceived, new { request.ma, senderId }, ct);
        return request.ma;
    }

    public async Task RespondAsync(long recipientId, long requestId, bool accept, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var request = await db.loi_moi_ket_bans.SingleOrDefaultAsync(x => x.ma == requestId, ct)
            ?? throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        if (request.ma_nguoi_nhan != recipientId) throw new BusinessException(BusinessErrorCode.KhongPhaiNguoiNhanLoiMoi);
        if (request.trang_thai != TrangThaiLoiMoiKetBan.Pending) throw new BusinessException(BusinessErrorCode.LoiMoiDaDuocXuLy);

        var now = clock.UtcNow;
        request.trang_thai = accept ? TrangThaiLoiMoiKetBan.Accepted : TrangThaiLoiMoiKetBan.Rejected;
        request.thoi_diem_phan_hoi = now;
        if (accept)
        {
            db.ban_bes.Add(new ban_be
            {
                ma_nguoi_dung_nho = request.ma_nguoi_dung_nho,
                ma_nguoi_dung_lon = request.ma_nguoi_dung_lon,
                ma_loi_moi_nguon = request.ma,
                ngay_tao = now
            });
        }
        AddNotification(request.ma_nguoi_gui,
            accept ? TrangThaiThongBao.FriendRequestAccepted : TrangThaiThongBao.FriendRequestRejected,
            recipientId, request.ma);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.UserAsync(request.ma_nguoi_gui, RealtimeEvent.NotificationReceived, new { requestId, accepted = accept }, ct);
        await notifier.UserAsync(recipientId, RealtimeEvent.InviteUpdated, new { requestId, status = request.trang_thai }, ct);
    }

    public async Task CancelRequestAsync(long senderId, long requestId, CancellationToken ct = default)
    {
        var request = await db.loi_moi_ket_bans.SingleOrDefaultAsync(x => x.ma == requestId, ct)
            ?? throw new BusinessException(BusinessErrorCode.LoiMoiKhongConHieuLuc);
        if (request.ma_nguoi_gui != senderId) throw new BusinessException(BusinessErrorCode.KhongDuQuyen);
        if (request.trang_thai != TrangThaiLoiMoiKetBan.Pending) throw new BusinessException(BusinessErrorCode.LoiMoiDaDuocXuLy);
        request.trang_thai = TrangThaiLoiMoiKetBan.Cancelled;
        request.thoi_diem_phan_hoi = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await notifier.UserAsync(request.ma_nguoi_nhan, RealtimeEvent.InviteUpdated, new { requestId, status = request.trang_thai }, ct);
    }

    public async Task UnfriendAsync(long userId, long friendId, CancellationToken ct = default)
    {
        var low = Math.Min(userId, friendId);
        var high = Math.Max(userId, friendId);
        var friendship = await db.ban_bes.SingleOrDefaultAsync(x => x.ma_nguoi_dung_nho == low && x.ma_nguoi_dung_lon == high, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongTimThayDuLieu);
        db.ban_bes.Remove(friendship);
        await db.SaveChangesAsync(ct);
    }

    private void AddNotification(long recipient, string type, long? actor, long requestId) => db.thong_baos.Add(new thong_bao
    {
        ma_nguoi_dung = recipient,
        loai = type,
        ma_nguoi_thuc_hien = actor,
        ma_loi_moi_ket_ban = requestId,
        du_lieu_phu = JsonSerializer.Serialize(new { requestId }),
        ngay_tao = clock.UtcNow
    });
}
