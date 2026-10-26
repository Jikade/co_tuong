namespace CoTuong.Core.Dtos;

/// <summary>Du lieu dang ky tai khoan (README muc 1).</summary>
public sealed record RegisterRequest(
    string TenDangNhap,
    string TenHienThi,
    string Email,
    string MatKhau,
    string XacNhanMatKhau);

/// <summary>Du lieu dang nhap (README muc 2).</summary>
public sealed record LoginRequest(
    string TenDangNhap,
    string MatKhau);

/// <summary>Du lieu yeu cau dat lai mat khau (README muc 2.1).</summary>
public sealed record ForgotPasswordRequest(string Email);

/// <summary>Du lieu dat lai mat khau (README muc 2.1).</summary>
public sealed record ResetPasswordRequest(
    string Token,
    string MatKhauMoi,
    string XacNhanMatKhauMoi);

/// <summary>Ket qua dang nhap.</summary>
public sealed record LoginResult(
    long MaNguoiDung,
    string TenDangNhap,
    string TenHienThi,
    string AccessToken,
    DateTime AccessTokenHetHan,
    string RefreshToken,
    DateTime RefreshTokenHetHan,
    long MaPhienDangNhap);

/// <summary>Thong tin tai khoan hien thi.</summary>
public sealed record TaiKhoanInfo(
    long MaNguoiDung,
    string TenDangNhap,
    string TenHienThi,
    string Email);
