namespace CoTuong.Core.Dtos;

/// <summary>Tai khoan tim duoc khi tim kiem (README muc 2.2).</summary>
/// <param name="MaNguoiDung">Ma tai khoan.</param>
/// <param name="TenDangNhap">Ten dang nhap.</param>
/// <param name="TenHienThi">Ten hien thi.</param>
/// <param name="TrangThai">Quan he: <c>None</c> | <c>BanBe</c> | <c>LoiMoiDangCho</c>.</param>
public sealed record TimKiemTaiKhoanResult(
    long MaNguoiDung,
    string TenDangNhap,
    string TenHienThi,
    string TrangThaiQuanHe);

/// <summary>Trang thai quan he tai khoan.</summary>
public static class TrangThaiQuanHe
{
    public const string None = "None";
    public const string BanBe = "BanBe";
    public const string LoiMoiDangCho = "LoiMoiDangCho";
}

/// <summary>Mot ban be hien thi (tieu thieu: ten hien thi, ten dang nhap, online/offline).</summary>
public sealed record BanBeItem(
    long MaBanBe,
    string TenDangNhap,
    string TenHienThi,
    bool DangOnline);

/// <summary>Mot loi moi ket ban dang cho (xem tai phia nguoi nhan).</summary>
public sealed record LoiMoiKetBanPendingItem(
    long MaLoiMoi,
    string TenDangNhapGui,
    string TenHienThiGui,
    bool DangOnline,
    DateTime NgayGoi);

public sealed record LoiMoiKetBanSentItem(
    long MaLoiMoi,
    string TenDangNhapNhan,
    string TenHienThiNhan,
    DateTime NgayGoi);

/// <summary>Ket qua tao Room (README muc 3).</summary>
public sealed record CreateRoomResult(
    long MaPhong,
    string MaSoPhong,
    string TokenMoi,
    string TenPhong,
    string CheDoHienThi,
    string TrangThai);
