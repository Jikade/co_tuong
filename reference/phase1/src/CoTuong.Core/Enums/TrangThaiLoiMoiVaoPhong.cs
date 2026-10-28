namespace CoTuong.Core.Enums;

/// <summary>Trang thai loi moi truc tiep vao Room. Kiep <c>CK_loi_moi_phong_trang_thai</c>.</summary>
public static class TrangThaiLoiMoiVaoPhong
{
    /// <summary>Dang cho phan hoi (han 60 giay).</summary>
    public const string Pending = "Pending";

    /// <summary>Nguoi duoc moi da tham gia Room.</summary>
    public const string Completed = "Completed";

    /// <summary>Nguoi duoc moi tu choi.</summary>
    public const string Declined = "Declined";

    /// <summary>Da het 60 giay ma khong phan hoi.</summary>
    public const string Expired = "Expired";

    /// <summary>Chu Room huy loi moi.</summary>
    public const string Cancelled = "Cancelled";

    /// <summary>Room dong / doi Chu Room / nguoi duoc moi bi chan.</summary>
    public const string Invalidated = "Invalidated";
}
