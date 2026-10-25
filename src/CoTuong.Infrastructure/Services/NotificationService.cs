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
        return await db.thong_baos.AsNoTracking().Where(x => x.ma_nguoi_dung == userId)
            .OrderByDescending(x => x.ngay_tao).Take(take)
            .Select(x => new ThongBaoItem(x.ma, x.loai, x.ma_nguoi_thuc_hien,
                x.ma_nguoi_thuc_hienNavigation == null ? null : x.ma_nguoi_thuc_hienNavigation.ten_hien_thi,
                x.ma_phong, x.ma_loi_moi_vao_phong, x.ma_loi_moi_ket_ban,
                x.du_lieu_phu, x.da_doc, x.ngay_tao)).ToListAsync(ct);
    }

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
