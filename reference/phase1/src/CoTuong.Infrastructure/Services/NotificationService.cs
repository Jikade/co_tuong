using CoTuong.Core.Dtos;
using CoTuong.Core.Abstractions;
using CoTuong.Core.Errors;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Infrastructure.Services;

public sealed class NotificationService(CoTuongDbContext db, IClock clock)
{
    public async Task<IReadOnlyList<ThongBaoItem>> ListAsync(long userId, int take = 50, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        var rows = await db.thong_baos.AsNoTracking().Where(x => x.ma_nguoi_dung == userId)
            .OrderByDescending(x => x.ngay_tao).Take(take)
            .Select(x => new
            {
                x.ma, x.loai, x.ma_nguoi_thuc_hien,
                TenNguoiThucHien = x.ma_nguoi_thuc_hienNavigation == null ? null : x.ma_nguoi_thuc_hienNavigation.ten_hien_thi,
                x.ma_phong, x.ma_loi_moi_vao_phong, x.ma_loi_moi_ket_ban,
                x.du_lieu_phu, x.da_doc, x.ngay_tao
            }).ToListAsync(ct);

        var inviteIds = rows.Where(x => x.ma_loi_moi_vao_phong is > 0).Select(x => x.ma_loi_moi_vao_phong!.Value).ToArray();
        var expiries = inviteIds.Length == 0 ? new Dictionary<long, DateTime?>()
            : await db.loi_moi_vao_phongs.AsNoTracking()
                .Where(x => inviteIds.Contains(x.ma))
                .ToDictionaryAsync(x => x.ma, x => (DateTime?)x.thoi_diem_het_han, ct);

        return rows.Select(x => new ThongBaoItem(x.ma, x.loai, x.ma_nguoi_thuc_hien, x.TenNguoiThucHien,
            x.ma_phong, x.ma_loi_moi_vao_phong, x.ma_loi_moi_ket_ban, x.du_lieu_phu, x.da_doc, x.ngay_tao,
            x.ma_loi_moi_vao_phong is > 0 ? expiries[x.ma_loi_moi_vao_phong!.Value] : null)).ToArray();
    }

    /// <summary>So thong bao chua doc — dung cho badge do menu.</summary>
    public async Task<int> CountUnreadAsync(long userId, CancellationToken ct = default) =>
        await db.thong_baos.AsNoTracking().CountAsync(x => x.ma_nguoi_dung == userId && !x.da_doc, ct);

    public async Task MarkReadAsync(long userId, long notificationId, CancellationToken ct = default)
    {
        var notification = await db.thong_baos.SingleOrDefaultAsync(x => x.ma == notificationId && x.ma_nguoi_dung == userId, ct)
            ?? throw new BusinessException(BusinessErrorCode.KhongTimThayDuLieu);
        if (notification.da_doc) return;
        notification.da_doc = true;
        notification.thoi_diem_doc = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
