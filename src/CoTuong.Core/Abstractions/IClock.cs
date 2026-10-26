namespace CoTuong.Core.Abstractions;

/// <summary>
/// Dong ho UTC. Moi thoi gian luu trong DB la UTC (quy uoc trong script schema),
/// nen khong bao gio dung <c>DateTime.Now</c> hay <c>DateTime.UtcNow</c> truc tiep.
/// Dung interface nay de test duoc cac moc thoi gian nghiep vu
/// (60 giay hieu luc loi moi, 15 phut hieu luc token dat lai mat khau).
/// </summary>
public interface IClock
{
    /// <summary>Thoi diem hien tai, luon la UTC (<see cref="DateTimeKind.Utc"/>).</summary>
    DateTime UtcNow { get; }
}
