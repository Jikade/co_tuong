namespace CoTuong.Core.Enums;

/// <summary>
/// Loai thao tac duoc bao ve boi khoa idempotency.
/// Kiep <c>CK_yc_cl_loai</c> trong bang mo rong <c>dbo.yeu_cau_chong_lap</c>.
/// </summary>
public static class LoaiYeuCauChongLap
{
    public const string Register = "Register";
    public const string Login = "Login";
    public const string CreateRoom = "CreateRoom";
    public const string JoinRoom = "JoinRoom";
    public const string StartMatch = "StartMatch";
    public const string Ready = "Ready";
    public const string FriendRequest = "FriendRequest";
    public const string RoomInvite = "RoomInvite";
    public const string SendChat = "SendChat";
    public const string ResetPassword = "ResetPassword";
}
