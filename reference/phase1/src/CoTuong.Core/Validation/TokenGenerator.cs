using System.Security.Cryptography;

namespace CoTuong.Core.Validation;

/// <summary>Cryptographically secure opaque tokens and six digit room codes.</summary>
public static class TokenGenerator
{
    public static string GenerateOpaqueToken(int byteLength = 32)
    {
        if (byteLength < 16 || byteLength > 128)
        {
            throw new ArgumentOutOfRangeException(nameof(byteLength));
        }

        return Convert.ToHexString(RandomNumberGenerator.GetBytes(byteLength)).ToLowerInvariant();
    }

    public static string HashToken(string token)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(token);
        return Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    }

    public static string GenerateRoomCode() => RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString(System.Globalization.CultureInfo.InvariantCulture);
}
