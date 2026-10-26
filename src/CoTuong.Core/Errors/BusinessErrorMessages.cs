namespace CoTuong.Core.Errors;

/// <summary>
/// Thong diep tieng Viet cho tung ma loi nghiep vu.
///
/// <para>README quy dinh thong bao loi ngay tai noi can sua, nen thong diep
/// phai dat cu the va khong lo thong tin ngoi dung (vi du: "Sai ten dang nhap
/// hoac mat khau" chu khong phai "Ten dang nhap khong ton tai").</para>
/// </summary>
public static class BusinessErrorMessages
{
    private static readonly Dictionary<string, string> _thongDiep = new(StringComparer.Ordinal)
    {
        [BusinessErrorCode.TenDangNhapDaTonTai] =
            "Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.",
        [BusinessErrorCode.EmailDaTonTai] =
            "Email này đã được đăng ký. Vui lòng sử dụng email khác.",
        [BusinessErrorCode.ThongTinDangNhapKhongDung] =
            "Tên đăng nhập hoặc mật khẩu không đúng.",
        [BusinessErrorCode.TaiKhoanKhongHoatDong] =
            "Tài khoản đang không hoạt động.",
        [BusinessErrorCode.MatKhauKhongDungQuyTac] =
            "Mật khẩu phải có ít nhất 8 ký tự và chứa cả chữ và số.",
        [BusinessErrorCode.MatKhauXacNhanKhongKhop] =
            "Mật khẩu và xác nhận mật khẩu không khớp.",
        [BusinessErrorCode.TenDangNhapKhongHopLe] =
            "Tên đăng nhập phải từ 3 đến 50 ký tự, chỉ gồm chữ, số, dấu gạch dưới và dấu chấm.",
        [BusinessErrorCode.EmailKhongHopLe] =
            "Email không đúng định dạng.",
        [BusinessErrorCode.TenHienThiKhongHopLe] =
            "Tên hiển thị phải từ 1 đến 50 ký tự.",
        [BusinessErrorCode.LinkDatLaiMatKhauKhongHieuLuc] =
            "Liên kết đặt lại mật khẩu không còn hiệu lực.",
        [BusinessErrorCode.VuaYeuCauDatLaiMatKhau] =
            "Bạn đã yêu cầu đặt lại mật khẩu gần đây. Vui lòng thử lại sau.",
        [BusinessErrorCode.KhongTheTuDangKy] =
            "Không thể tự đăng ký. Vui lòng thử lại sau.",

        [BusinessErrorCode.KhongTuGuiLoiMoiChoBanThan] =
            "Bạn không thể gửi lời mời kết bạn cho chính mình.",
        [BusinessErrorCode.DaLaBanBe] =
            "Hai tài khoản đã là bạn bè.",
        [BusinessErrorCode.DaCoLoiMoiDangCho] =
            "Đã tồn tại một lời mời kết bạn đang chờ xử lý giữa hai tài khoản.",
        [BusinessErrorCode.LoiMoiKhongConHieuLuc] =
            "Lời mời không còn hiệu lực.",
        [BusinessErrorCode.LoiMoiDaDuocXuLy] =
            "Lời mời đã được xử lý.",
        [BusinessErrorCode.KhongPhaiNguoiNhanLoiMoi] =
            "Bạn không phải người nhận lời mời này.",

        [BusinessErrorCode.KhongTimThayRoom] =
            "Không tìm thấy Room.",
        [BusinessErrorCode.RoomKhongConKhaDung] =
            "Room không còn khả dụng.",
        [BusinessErrorCode.RoomDaDong] =
            "Room đã đóng.",
        [BusinessErrorCode.TenRoomKhongHopLe] =
            "Tên Room phải từ 1 đến 100 ký tự.",
        [BusinessErrorCode.MaRoomKhongHopLe] =
            "Mã Room phải gồm đúng 6 chữ số.",
        [BusinessErrorCode.PhongDaDay] =
            "Room hiện đã đầy.",
        [BusinessErrorCode.ODoiThuDaCoNguoi] =
            "Vị trí đã có người.",
        [BusinessErrorCode.KhongPhaiChuRoom] =
            "Chỉ Chủ Room mới thực hiện được thao tác này.",
        [BusinessErrorCode.DaBiDaKhoiPhong] =
            "Bạn đã bị đá khỏi Room và không thể tham gia lại Room này.",
        [BusinessErrorCode.KhongDuQuyen] =
            "Bạn không có quyền thực hiện thao tác này.",
        [BusinessErrorCode.RoomDaCoMatch] =
            "Room đã có Match đang diễn ra.",
        [BusinessErrorCode.ChuaSanSang] =
            "Cả Chủ Room và Đối thủ đều phải Sẵn sàng thì mới có thể bắt đầu.",
        [BusinessErrorCode.KhongTheMoVaiTroDoiThu] =
            "Không thể chuyển sang vị trí Đối thủ lúc này.",
        [BusinessErrorCode.ChuaDongKy] =
            "Vui lòng đăng nhập trước khi thực hiện thao tác này.",

        [BusinessErrorCode.NguoiChoiDangOffline] =
            "Người chơi hiện đang Offline.",
        [BusinessErrorCode.KhongPhaiBanBe] =
            "Chỉ có thể mời người đã là bạn bè. Vui lòng cập nhật danh sách Bạn bè.",
        [BusinessErrorCode.DaCoLoiMoiDangChoPhanHoi] =
            "Đã có một lời mời đang chờ phản hồi. Vui lòng chờ hoặc hủy lời mời cũ.",
        [BusinessErrorCode.LoiMoiVaoRoomHetHan] =
            "Lời mời đã hết thời gian hiệu lực.",
        [BusinessErrorCode.NguoiChoiDaTuChoiLoiMoi] =
            "Người chơi đã từ chối lời mời.",

        [BusinessErrorCode.ThaoTacKhongHopLe] =
            "Thao tác không hợp lệ.",
        [BusinessErrorCode.KhongTimThayDuLieu] =
            "Không tìm thấy dữ liệu.",
    };

    /// <summary>Tra ve thong diep cho ma loi; neu khong biet thi dung thong diep chung.</summary>
    public static string Get(string maLoi) =>
        _thongDiep.TryGetValue(maLoi, out var msg) ? msg : "Đã xảy ra lỗi. Vui lòng thử lại.";
}
