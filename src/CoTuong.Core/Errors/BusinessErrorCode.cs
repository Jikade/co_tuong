namespace CoTuong.Core.Errors;

/// <summary>
/// Ma loi nghiep vu. Moi ma an 1 thong diep tieng Viet duy nhat
/// (README quy dinh thong bao loi ngay tai noi can sua).
/// </summary>
public static class BusinessErrorCode
{
    // --- Tai khoan / xac thuc ---------------------------------------------
    public const string TenDangNhapDaTonTai = "TEN_DANG_NHAP_DA_TON_TAI";
    public const string EmailDaTonTai = "EMAIL_DA_TON_TAI";
    public const string ThongTinDangNhapKhongDung = "THONG_TIN_DANG_NHAP_KHONG_DUNG";
    public const string TaiKhoanKhongHoatDong = "TAI_KHOAN_KHONG_HOAT_DONG";
    public const string MatKhauKhongDungQuyTac = "MAT_KHAU_KHONG_DUNG_QUY_TAC";
    public const string MatKhauXacNhanKhongKhop = "MAT_KHAU_XAC_NHAN_KHONG_KHOP";
    public const string TenDangNhapKhongHopLe = "TEN_DANG_NHAP_KHONG_HOP_LE";
    public const string EmailKhongHopLe = "EMAIL_KHONG_HOP_LE";
    public const string TenHienThiKhongHopLe = "TEN_HIEN_THI_KHONG_HOP_LE";
    public const string LinkDatLaiMatKhauKhongHieuLuc = "LINK_DAT_LAI_MAT_KHAU_KHONG_HIEU_LUC";
    public const string VuaYeuCauDatLaiMatKhau = "VUA_YEU_CAU_DAT_LAI_MAT_KHAU";
    public const string KhongTheTuDangKy = "KHONG_THE_TU_DANG_KY";

    // --- Ban be ----------------------------------------------------------
    public const string KhongTuGuiLoiMoiChoBanThan = "KHONG_TU_GUI_LOI_MOI_CHO_BAN_THAN";
    public const string DaLaBanBe = "DA_LA_BAN_BE";
    public const string DaCoLoiMoiDangCho = "DA_CO_LOI_MOI_DANG_CHO";
    public const string LoiMoiKhongConHieuLuc = "LOI_MOI_KHONG_CON_HIEU_LUC";
    public const string LoiMoiDaDuocXuLy = "LOI_MOI_DA_DUOC_XU_LY";
    public const string KhongPhaiNguoiNhanLoiMoi = "KHONG_PHAI_NGUOI_NHAN_LOI_MOI";

    // --- Room ------------------------------------------------------------
    public const string KhongTimThayRoom = "KHONG_TIM_THAY_ROOM";
    public const string RoomKhongConKhaDung = "ROOM_KHONG_CON_KHA_DUNG";
    public const string RoomDaDong = "ROOM_DA_DONG";
    public const string TenRoomKhongHopLe = "TEN_ROOM_KHONG_HOP_LE";
    public const string MaRoomKhongHopLe = "MA_ROOM_KHONG_HOP_LE";
    public const string PhongDaDay = "PHONG_DA_DAY";
    public const string ODoiThuDaCoNguoi = "O_DOI_THU_DA_CO_NGUOI";
    public const string KhongPhaiChuRoom = "KHONG_PHAI_CHU_ROOM";
    public const string DaBiDaKhoiPhong = "DA_BI_DA_KHOI_PHONG";
    public const string KhongDuQuyen = "KHONG_DU_QUYEN";
    public const string RoomDaCoMatch = "ROOM_DA_CO_MATCH";
    public const string ChuaSanSang = "CHUA_SAN_SANG";
    public const string KhongTheMoVaiTroDoiThu = "KHONG_THE_MO_VAI_TRO_DOI_THU";
    public const string ChuaDongKy = "CHUA_DONG_KY";

    // --- Loi moi vao Room -------------------------------------------------
    public const string NguoiChoiDangOffline = "NGUOI_CHOI_DANG_OFFLINE";
    public const string KhongPhaiBanBe = "KHONG_PHAI_BAN_BE";
    public const string DaCoLoiMoiDangChoPhanHoi = "DA_CO_LOI_MOI_DANG_CHO_PHAN_HOI";
    public const string LoiMoiVaoRoomHetHan = "LOI_MOI_VAO_ROOM_HET_HAN";
    public const string NguoiChoiDaTuChoiLoiMoi = "NGUOI_CHOI_DA_TU_CHOI_LOI_MOI";

    // --- Chung ------------------------------------------------------------
    public const string ThaoTacKhongHopLe = "THAO_TAC_KHONG_HOP_LE";
    public const string KhongTimThayDuLieu = "KHONG_TIM_THAY_DU_LIEU";
}
