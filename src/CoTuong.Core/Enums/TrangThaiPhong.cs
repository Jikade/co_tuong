namespace CoTuong.Core.Enums;

/// <summary>
/// Trang thai cua Room. Kiep voi <c>CK_phong_trang_thai</c>.
///
/// <para>
/// Chu ky doi thuong:
/// <c>WaitingOpponent → Full → InMatch → WaitingNewMatch → (dong) Closed</c>.
/// Chuyen <c>InMatch</c> thuoc ve Phase 2; Phase 1 chi dung
/// <c>WaitingOpponent/Full/WaitingNewMatch/Closed</c> theo thuc te nghiep vu.</para>
/// </summary>
public static class TrangThaiPhong
{
    /// <summary>Da co Chu Room, o Doi thu trống.</summary>
    public const string WaitingOpponent = "WaitingOpponent";

    /// <summary>Da du hai nguoi, Match da tao, cho dem nguoc / khong co Doi thu moi.</summary>
    public const string Full = "Full";

    /// <summary>Tran dang dien ra (Phase 2).</summary>
    public const string InMatch = "InMatch";

    /// <summary>Match truoc da ket thuc, cho San sang de cho tran moi.</summary>
    public const string WaitingNewMatch = "WaitingNewMatch";

    /// <summary>Da dong — ma Room va link moi het hieu luc.</summary>
    public const string Closed = "Closed";
}
