namespace CoTuong.Core.Abstractions;

/// <summary>
/// Gui thong bao real-time toi client (SignalR).
///
/// <para>
/// Core khong tham chieu truc tiep SignalR de giu duoc ranh gioi tang lop.
/// Tieu chuan su kien dung <see cref="RealtimeEvent"/> de moi ben deu gui
/// cung ten — tranh viec client nhan ban ghi co ten khop.</para>
/// </summary>
public interface IRealtimeNotifier
{
    /// <summary>
    /// Gui su kien den tat ca thanh vien dang trong Room.
    /// </summary>
    Task RoomAsync(long maPhong, string tenSuKien, object? duLieu = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gui su kien den mot nguoi dung cu the (ke ca khi dang online o Room khac).
    /// </summary>
    Task UserAsync(long maNguoiDung, string tenSuKien, object? duLieu = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Thong bao danh sach Room cong khai thay doi (tao / dong / doi trang thai).
    /// </summary>
    Task PublicRoomsChangedAsync(CancellationToken cancellationToken = default);
}

/// <summary>Ten cac su kien real-time dung chung giua server va client.</summary>
public static class RealtimeEvent
{
    // --- Room ---------------------------------------------------------------
    public const string RoomStateChanged = "RoomStateChanged";
    public const string MemberJoined = "MemberJoined";
    public const string MemberLeft = "MemberLeft";
    public const string RoleChanged = "RoleChanged";
    public const string HostTransferred = "HostTransferred";
    public const string ReadyChanged = "ReadyChanged";
    public const string RoomClosed = "RoomClosed";
    public const string MatchStarted = "MatchStarted";

    // --- Loi moi ------------------------------------------------------------
    public const string InviteReceived = "InviteReceived";
    public const string InviteUpdated = "InviteUpdated";

    // --- Thong bao -----------------------------------------------------------
    public const string NotificationReceived = "NotificationReceived";
    public const string PublicRoomsChanged = "PublicRoomsChanged";
}
