namespace CoTuong.Core.Abstractions;

/// <summary>
/// Khoa theo Room, dung de giai quyet tranh chap khi nhieu nguoi thao tac
/// cung luc (vi du: hai nguoi bam vao o Doi thu trong cung khoang khong giay).
///
/// <para>
/// Schema khong the the hien <c>COUNT(*) &lt;= so_khan_gia_toi_da</c> bang CHECK,
/// va cac unique index chi chan o muc "lop bao ve cuoi cung". Voi vay Backend
/// phai dem + ghi trong cung mot transaction, co khoa theo <c>ma_phong</c>.</para>
/// </summary>
public interface IRoomLockProvider
{
    /// <summary>
    /// Acquire khoa cua Room. Phai duoc giai phong bang <c>using</c> (hoac
    /// <c>await using</c>).
    /// </summary>
    Task<IAsyncDisposable> AcquireAsync(long maPhong, CancellationToken cancellationToken = default);
}
