using CoTuong.Core.Validation;
using Xunit;

namespace CoTuong.Tests.Core.Validation;

/// <summary>
/// README muc 1: "Mat khau toi thieu 8 ky tu, co it nhat chu va so."
/// README muc 2.1: mat khau moi khi dat lai phai dung cung quy tac.
/// </summary>
public class PasswordPolicyTests
{
    [Theory]
    [InlineData("12345678")]        // chi so -> thieu chu
    [InlineData("abcdefgh")]        // chi chu -> thieu so
    [InlineData("Abc1")]            // qua ngan
    [InlineData("")]
    [InlineData(null)]
    public void IsValid_TraVeFalse_KhiKhongDungQuyTac(string? matKhau)
    {
        Assert.False(PasswordPolicy.IsValid(matKhau));
        Assert.NotNull(PasswordPolicy.DescribeViolation(matKhau));
    }

    [Theory]
    [InlineData("Abc12345")]        // 8 ky tu, chu + so
    [InlineData("Passw0rd")]
    [InlineData("a1bcdefg")]
    public void IsValid_TraVeTrue_KhiDungQuyTac(string matKhau)
    {
        Assert.True(PasswordPolicy.IsValid(matKhau));
        Assert.Null(PasswordPolicy.DescribeViolation(matKhau));
    }

    [Fact]
    public void DescribeViolation_NoiDungLyDoCuThe()
    {
        Assert.Contains("8", PasswordPolicy.DescribeViolation("Ab1"));
        Assert.Contains("chữ cái", PasswordPolicy.DescribeViolation("12345678"));
        Assert.Contains("chữ số", PasswordPolicy.DescribeViolation("abcdefgh"));
    }

    [Fact]
    public void IsValid_TuChoiMatKhauQuaDai()
    {
        var quaDai = new string('a', PasswordPolicy.DoDaiToiDa + 1) + "1";
        Assert.False(PasswordPolicy.IsValid(quaDai));
    }
}
