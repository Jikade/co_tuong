namespace CoTuong.Core.Validation;

/// <summary>
/// Quy tac mat khau theo README (muc 1 va 2.1):
/// "Mat khau toi thieu 8 ky tu, co it nhat chu va so."
///
/// <para>Quy tac nay ap dung cho ca mat khau dang ky, mat khau moi khi dat lai
/// (README: "Mat khau moi phai dap ung cung quy tac mat khau cua chuc nang Dang ky").</para>
/// </summary>
public static class PasswordPolicy
{
    public const int DoDaiToiThieu = 8;
    public const int DoDaiToiDa = 128;

    /// <summary>Kiem tra mat khau co dap ung quy tac khong.</summary>
    public static bool IsValid(string? matKhau) =>
        matKhau is not null
        && matKhau.Length >= DoDaiToiThieu
        && matKhau.Length <= DoDaiToiDa
        && matKhau.Any(char.IsLetter)
        && matKhau.Any(char.IsDigit);

    /// <summary>
    /// Mo ta chi tiet vi sao mat khau khong hop le (dung cho hien thi canh bao
    /// ngay tai o nhap trong UI).
    /// </summary>
    public static string? DescribeViolation(string? matKhau)
    {
        if (string.IsNullOrEmpty(matKhau))
        {
            return "Vui lòng nhập mật khẩu.";
        }

        if (matKhau.Length < DoDaiToiThieu)
        {
            return $"Mật khẩu phải có ít nhất {DoDaiToiThieu} ký tự.";
        }

        if (matKhau.Length > DoDaiToiDa)
        {
            return $"Mật khẩu không được vượt quá {DoDaiToiDa} ký tự.";
        }

        if (!matKhau.Any(char.IsLetter))
        {
            return "Mật khẩu phải có ít nhất một chữ cái.";
        }

        if (!matKhau.Any(char.IsDigit))
        {
            return "Mật khẩu phải có ít nhất một chữ số.";
        }

        return null;
    }
}
