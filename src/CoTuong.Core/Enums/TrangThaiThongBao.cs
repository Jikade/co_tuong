namespace CoTuong.Core.Enums;

/// <summary>
/// Cac loai thong bao duoc PHAI ghi vao bang <c>dbo.thong_bao</c>.
/// Kiep chinh xac voi <c>CK_thong_bao_loai</c>.
///
/// <para>
/// Luu y (gap G2 trong ke hoach): bang chi cho phep 7 loai nay. Cac su kien
/// khac cua Phase 1 (chuyen Chu Room, Doi thu da vao, Bat dau Match) KHONG
/// ghi vao bang nay — chung chi duoc phat qua SignalR. Do do
/// <c>NotificationWriter</c> phai tu choi loai khong hop le.</para>
/// </summary>
public static class TrangThaiThongBao
{
    public const string FriendRequestReceived = "FriendRequestReceived";
    public const string FriendRequestAccepted = "FriendRequestAccepted";
    public const string FriendRequestRejected = "FriendRequestRejected";
    public const string RoomInvitationReceived = "RoomInvitationReceived";
    public const string RoomInvitationDeclined = "RoomInvitationDeclined";
    public const string RoomInvitationCancelled = "RoomInvitationCancelled";
    public const string RoomInvitationExpired = "RoomInvitationExpired";

    /// <summary>Tap cac loai duoc phep ghi vao bang thong bao.</summary>
    public static readonly IReadOnlySet<string> ChoPhepGhiVaoBang = new HashSet<string>(StringComparer.Ordinal)
    {
        FriendRequestReceived,
        FriendRequestAccepted,
        FriendRequestRejected,
        RoomInvitationReceived,
        RoomInvitationDeclined,
        RoomInvitationCancelled,
        RoomInvitationExpired,
    };
}
