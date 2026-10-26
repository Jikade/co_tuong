using System.ComponentModel.DataAnnotations;

namespace CoTuong.Web.Components.Pages.Account;

public sealed class RegisterForm
{
    [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập.")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Tên đăng nhập phải từ 3 đến 50 ký tự.")]
    public string TenDangNhap { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập tên hiển thị.")]
    [StringLength(50, ErrorMessage = "Tên hiển thị tối đa 50 ký tự.")]
    public string TenHienThi { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    [MinLength(8, ErrorMessage = "Mật khẩu cần ít nhất 8 ký tự.")]
    public string MatKhau { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng xác nhận mật khẩu.")]
    [Compare(nameof(MatKhau), ErrorMessage = "Mật khẩu xác nhận không khớp.")]
    public string XacNhanMatKhau { get; set; } = string.Empty;
}

public sealed class LoginForm
{
    [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập.")]
    public string TenDangNhap { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    public string MatKhau { get; set; } = string.Empty;
}

public sealed class EmailForm
{
    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    public string Email { get; set; } = string.Empty;
}

public sealed class ResetPasswordForm
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu mới.")]
    [MinLength(8, ErrorMessage = "Mật khẩu cần ít nhất 8 ký tự.")]
    public string MatKhauMoi { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng xác nhận mật khẩu mới.")]
    [Compare(nameof(MatKhauMoi), ErrorMessage = "Mật khẩu xác nhận không khớp.")]
    public string XacNhanMatKhauMoi { get; set; } = string.Empty;
}

public sealed record BrowserApiResult(bool Ok, int Status, System.Text.Json.JsonElement Data);
