using System.Text.RegularExpressions;

namespace CoTuong.Core.Validation;

/// <summary>Quy tac kiem tra ten dang nhap.</summary>
public static class TenDangNhapValidator
{
    public const int DoDaiToiThieu = 3;
    public const int DoDaiToiDa = 50;

    private static readonly Regex _mau = new(@"^[A-Za-z0-9_.]+$", RegexOptions.Compiled);

    public static bool IsValid(string? tenDangNhap) =>
        !string.IsNullOrWhiteSpace(tenDangNhap)
        && tenDangNhap.Trim().Length >= DoDaiToiThieu
        && tenDangNhap.Trim().Length <= DoDaiToiDa
        && _mau.IsMatch(tenDangNhap.Trim());

    public static string? DescribeViolation(string? tenDangNhap)
    {
        if (string.IsNullOrWhiteSpace(tenDangNhap))
        {
            return "Vui lòng nhập tên đăng nhập.";
        }

        var giaTri = tenDangNhap.Trim();
        if (giaTri.Length < DoDaiToiThieu || giaTri.Length > DoDaiToiDa)
        {
            return $"Tên đăng nhập phải từ {DoDaiToiThieu} đến {DoDaiToiDa} ký tự.";
        }

        if (!_mau.IsMatch(giaTri))
        {
            return "Tên đăng nhập chỉ gồm chữ, số, dấu gạch dưới và dấu chấm.";
        }

        return null;
    }
}

/// <summary>Quy tac kiem tra ten hien thi.</summary>
public static class TenHienThiValidator
{
    public const int DoDaiToiDa = 50;

    public static bool IsValid(string? tenHienThi) =>
        !string.IsNullOrWhiteSpace(tenHienThi) && tenHienThi.Trim().Length <= DoDaiToiDa;

    public static string? DescribeViolation(string? tenHienThi)
    {
        if (string.IsNullOrWhiteSpace(tenHienThi))
        {
            return "Vui lòng nhập tên hiển thị.";
        }

        if (tenHienThi.Trim().Length > DoDaiToiDa)
        {
            return $"Tên hiển thị không được vượt quá {DoDaiToiDa} ký tự.";
        }

        return null;
    }
}

/// <summary>Quy tac kiem tra email.</summary>
public static class EmailValidator
{
    /// <summary>
    /// Kiem tra dinh dang email. Dung <see cref="System.Net.Mail.MailAddress"/> de
    /// phat hien loi cu xung, sau do chan them cac truong hop khong hop le.
    /// </summary>
    public static bool IsValid(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        var giaTri = email.Trim();
        if (giaTri.Length > 254)
        {
            return false;
        }

        try
        {
            var diaChi = new System.Net.Mail.MailAddress(giaTri);
            if (!string.Equals(diaChi.Address, giaTri, StringComparison.OrdinalIgnoreCase))
            {
                // MailAddress tu sua/chuan hoa dia chi (vd "a@b" -> "a@b"); yeu cau khop nguyen ban.
                return false;
            }
        }
        catch (FormatException)
        {
            return false;
        }

        var parts = giaTri.Split('@');
        return parts.Length == 2
            && parts[0].Length > 0
            && parts[1].Contains('.')
            && !parts[1].StartsWith('.')
            && !parts[1].EndsWith('.');
    }

    public static string? DescribeViolation(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return "Vui lòng nhập email.";
        }

        return IsValid(email) ? null : "Email không đúng định dạng.";
    }
}

/// <summary>Quy tac kiem tra ten Room.</summary>
public static class TenPhongValidator
{
    public const int DoDaiToiDa = 100;

    public static bool IsValid(string? tenPhong) =>
        !string.IsNullOrWhiteSpace(tenPhong) && tenPhong.Trim().Length <= DoDaiToiDa;

    public static string? DescribeViolation(string? tenPhong)
    {
        if (string.IsNullOrWhiteSpace(tenPhong))
        {
            return "Vui lòng nhập tên Room.";
        }

        if (tenPhong.Trim().Length > DoDaiToiDa)
        {
            return $"Tên Room không được vượt quá {DoDaiToiDa} ký tự.";
        }

        return null;
    }
}

/// <summary>Quy tac kiem tra ma Room (6 chu so).</summary>
public static class MaPhongValidator
{
    public const int DoDai = 6;

    public static bool IsValid(string? maPhong) =>
        maPhong is not null
        && maPhong.Trim().Length == DoDai
        && maPhong.Trim().All(char.IsAsciiDigit);

    public static string? DescribeViolation(string? maPhong)
    {
        if (string.IsNullOrWhiteSpace(maPhong))
        {
            return "Vui lòng nhập mã Room.";
        }

        if (maPhong.Trim().Length != DoDai || !maPhong.Trim().All(char.IsAsciiDigit))
        {
            return "Mã Room phải gồm đúng 6 chữ số.";
        }

        return null;
    }
}
