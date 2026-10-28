namespace CoTuong.Infrastructure.Services;

public sealed class AuthOptions
{
    public string Issuer { get; set; } = "CoTuongOnline";
    public string Audience { get; set; } = "CoTuongOnline";
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;
    public string PublicBaseUrl { get; set; } = "https://localhost:7080";
}
