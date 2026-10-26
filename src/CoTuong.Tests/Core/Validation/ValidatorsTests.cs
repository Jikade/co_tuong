using CoTuong.Core.Validation;
using Xunit;

namespace CoTuong.Tests.Core.Validation;

public class MaPhongValidatorTests
{
    [Theory]
    [InlineData("123456")]
    [InlineData("000000")]
    [InlineData("999999")]
    public void IsValid_TraVeTrue_KhiLa6ChuSo(string maPhong)
    {
        Assert.True(MaPhongValidator.IsValid(maPhong));
        Assert.Null(MaPhongValidator.DescribeViolation(maPhong));
    }

    [Theory]
    [InlineData("12345")]       // thieu 1 so
    [InlineData("1234567")]     // thua 1 so
    [InlineData("12345a")]      // co chu
    [InlineData("")]
    [InlineData(null)]
    public void IsValid_TraVeFalse_KhiSaiDinhDang(string? maPhong)
    {
        Assert.False(MaPhongValidator.IsValid(maPhong));
        Assert.NotNull(MaPhongValidator.DescribeViolation(maPhong));
    }
}

public class EmailValidatorTests
{
    [Theory]
    [InlineData("a@b.com")]
    [InlineData("nguyen.viet@example.com")]
    [InlineData("test+tag@sub.domain.vn")]
    public void IsValid_TraVeTrue_KhiDinhDangHopLe(string email)
    {
        Assert.True(EmailValidator.IsValid(email));
    }

    [Theory]
    [InlineData("khong-co-at")]
    [InlineData("@domain.com")]
    [InlineData("user@")]
    [InlineData("user@domain")]
    [InlineData("user@.com")]
    [InlineData("user@domain.")]
    [InlineData("")]
    [InlineData(null)]
    public void IsValid_TraVeFalse_KhiSaiDinhDang(string? email)
    {
        Assert.False(EmailValidator.IsValid(email));
        Assert.NotNull(EmailValidator.DescribeViolation(email));
    }
}

public class TenDangNhapValidatorTests
{
    [Theory]
    [InlineData("abc")]
    [InlineData("nguyen_viet")]
    [InlineData("player01")]
    [InlineData("a.b_c")]
    public void IsValid_TraVeTrue_KhiHopLe(string tenDangNhap)
    {
        Assert.True(TenDangNhapValidator.IsValid(tenDangNhap));
    }

    [Theory]
    [InlineData("ab")]                    // qua ngan
    [InlineData("co khoang trang")]       // co dau cach
    [InlineData("co-dau-gach")]           // dau gach khong duoc phep
    [InlineData("")]
    [InlineData(null)]
    public void IsValid_TraVeFalse_KhiKhongHopLe(string? tenDangNhap)
    {
        Assert.False(TenDangNhapValidator.IsValid(tenDangNhap));
    }
}

public class TenPhongValidatorTests
{
    [Fact]
    public void IsValid_TraVeFalse_KhiRongHoacQuaDai()
    {
        Assert.False(TenPhongValidator.IsValid("   "));
        Assert.False(TenPhongValidator.IsValid(new string('a', TenPhongValidator.DoDaiToiDa + 1)));
        Assert.True(TenPhongValidator.IsValid("Phong choi thu"));
    }
}

public class TenHienThiValidatorTests
{
    [Fact]
    public void IsValid_TraVeFalse_KhiRongHoacQuaDai()
    {
        Assert.False(TenHienThiValidator.IsValid("  "));
        Assert.False(TenHienThiValidator.IsValid(new string('a', TenHienThiValidator.DoDaiToiDa + 1)));
        Assert.True(TenHienThiValidator.IsValid("Nguyễn Việt"));
    }
}
