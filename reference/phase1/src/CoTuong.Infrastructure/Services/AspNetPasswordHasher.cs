using CoTuong.Core.Abstractions;
using CoTuong.Infrastructure.Entities;
using Microsoft.AspNetCore.Identity;

namespace CoTuong.Infrastructure.Services;

/// <summary>Uses ASP.NET Core Identity's versioned PBKDF2 password format.</summary>
public sealed class AspNetPasswordHasher : IPasswordHasher
{
    private readonly PasswordHasher<nguoi_dung> _hasher = new();

    public string Hash(string matKhau)
    {
        ArgumentException.ThrowIfNullOrEmpty(matKhau);
        return _hasher.HashPassword(new nguoi_dung(), matKhau);
    }

    public bool Verify(string matKhau, string hash)
    {
        if (string.IsNullOrEmpty(matKhau) || string.IsNullOrEmpty(hash))
        {
            return false;
        }

        try
        {
            var result = _hasher.VerifyHashedPassword(new nguoi_dung(), hash, matKhau);
            return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
        }
        catch (FormatException)
        {
            return false;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}
