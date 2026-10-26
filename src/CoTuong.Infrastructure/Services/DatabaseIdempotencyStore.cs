using CoTuong.Core.Abstractions;
using CoTuong.Core.Enums;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Infrastructure.Services;

/// <summary>
/// Luu khoa idempotency vao bang <c>dbo.yeu_cau_chong_lap</c>.
///
/// <para>
/// Bang co unique index <c>UX_yc_cl_nguoi_loai_khoa (ma_nguoi_dung, loai_yeu_cau,
/// khoa_idempotency)</c>, nen <see cref="TryBeginAsync"/> an toan ngay ca khi nhieu
/// request song song: chi mot request ghi duoc khoa truoc; cac request con lai
/// vaoc unique constraint (SQL 2601/2627) va tra ve <c>false</c>.
/// </para>
/// </summary>
public sealed class DatabaseIdempotencyStore(CoTuongDbContext db, IClock clock) : IIdempotencyStore
{
    public async Task<bool> TryBeginAsync(long maNguoiDung, string loaiYeuCau, string khoa, CancellationToken cancellationToken = default)
    {
        var exists = await db.yeu_cau_chong_laps.AsNoTracking()
            .AnyAsync(x => x.ma_nguoi_dung == maNguoiDung && x.loai_yeu_cau == loaiYeuCau && x.khoa_idempotency == khoa, cancellationToken);
        if (exists) return false;

        db.yeu_cau_chong_laps.Add(new yeu_cau_chong_lap
        {
            ma_nguoi_dung = maNguoiDung,
            loai_yeu_cau = loaiYeuCau,
            khoa_idempotency = khoa,
            ngay_tao = clock.UtcNow
        });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            db.ChangeTracker.Clear();
            return false; // request song song ghi truoc — co the thuc hien duoc lan do
        }
    }

    public async Task SaveResultAsync(long maNguoiDung, string loaiYeuCau, string khoa, string ketQuaJson, CancellationToken cancellationToken = default)
    {
        await db.yeu_cau_chong_laps
            .Where(x => x.ma_nguoi_dung == maNguoiDung && x.loai_yeu_cau == loaiYeuCau && x.khoa_idempotency == khoa)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ket_qua_bam, ketQuaJson), cancellationToken);
    }

    public async Task<string?> GetResultAsync(long maNguoiDung, string loaiYeuCau, string khoa, CancellationToken cancellationToken = default) =>
        await db.yeu_cau_chong_laps.AsNoTracking()
            .Where(x => x.ma_nguoi_dung == maNguoiDung && x.loai_yeu_cau == loaiYeuCau && x.khoa_idempotency == khoa)
            .Select(x => x.ket_qua_bam).FirstOrDefaultAsync(cancellationToken);

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.GetBaseException() is Microsoft.Data.SqlClient.SqlException sql && sql.Number is 2601 or 2627;
}
