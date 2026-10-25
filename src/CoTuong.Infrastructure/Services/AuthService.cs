using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CoTuong.Core.Abstractions;
using CoTuong.Core.Dtos;
using CoTuong.Core.Enums;
using CoTuong.Core.Errors;
using CoTuong.Core.Validation;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CoTuong.Infrastructure.Services;

/// <summary>Phase 1 account, session, and password recovery workflows.</summary>
public sealed class AuthService(
    CoTuongDbContext db,
    IClock clock,
    IPasswordHasher passwordHasher,
    IEmailSender emailSender,
    IOptions<AuthOptions> options)
{
    private static readonly TimeSpan ResetTokenLifetime = TimeSpan.FromMinutes(15);
    private readonly AuthOptions _options = options.Value;

    public async Task<TaiKhoanInfo> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        ValidateRegistration(request);

        var username = request.TenDangNhap.Trim();
        var email = request.Email.Trim();
        if (await db.nguoi_dungs.AnyAsync(x => x.ten_dang_nhap == username, cancellationToken))
        {
            throw new BusinessException(BusinessErrorCode.TenDangNhapDaTonTai);
        }

        if (await db.nguoi_dungs.AnyAsync(x => x.email == email, cancellationToken))
        {
            throw new BusinessException(BusinessErrorCode.EmailDaTonTai);
        }

        var user = new nguoi_dung
        {
            ten_dang_nhap = username,
            ten_hien_thi = request.TenHienThi.Trim(),
            email = email,
            mat_khau_bam = passwordHasher.Hash(request.MatKhau),
            dang_hoat_dong = true,
            thoi_diem_doi_mat_khau = clock.UtcNow
        };
        db.nguoi_dungs.Add(user);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            db.Entry(user).State = EntityState.Detached;
            if (await db.nguoi_dungs.AnyAsync(x => x.ten_dang_nhap == username, cancellationToken))
            {
                throw new BusinessException(BusinessErrorCode.TenDangNhapDaTonTai, ex);
            }
            if (await db.nguoi_dungs.AnyAsync(x => x.email == email, cancellationToken))
            {
                throw new BusinessException(BusinessErrorCode.EmailDaTonTai, ex);
            }
            throw;
        }

        return ToAccountInfo(user);
    }

    public async Task<LoginResult> LoginAsync(LoginRequest request, string? userAgent = null, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var username = request.TenDangNhap?.Trim() ?? string.Empty;
        var user = await db.nguoi_dungs.SingleOrDefaultAsync(x => x.ten_dang_nhap == username, cancellationToken);
        if (user is null || !passwordHasher.Verify(request.MatKhau ?? string.Empty, user.mat_khau_bam))
        {
            throw new BusinessException(BusinessErrorCode.ThongTinDangNhapKhongDung);
        }
        if (!user.dang_hoat_dong)
        {
            throw new BusinessException(BusinessErrorCode.ThongTinDangNhapKhongDung);
        }

        var now = clock.UtcNow;
        var refreshToken = TokenGenerator.GenerateOpaqueToken();
        var session = new phien_dang_nhap
        {
            ma_nguoi_dung = user.ma,
            refresh_token_bam = TokenGenerator.HashToken(refreshToken),
            trinh_duyet = Limit(userAgent, 500),
            dia_chi_ip = Limit(ipAddress, 45),
            ngay_tao = now,
            lan_dung_cuoi = now,
            thoi_diem_het_han = now.AddDays(_options.RefreshTokenDays)
        };
        user.lan_dang_nhap_cuoi = now;
        db.phien_dang_nhaps.Add(session);
        await db.SaveChangesAsync(cancellationToken);
        return CreateLoginResult(user, refreshToken, now, session.thoi_diem_het_han, session.ma);
    }

    public async Task<LoginResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var hash = TokenGenerator.HashToken(refreshToken);
        var now = clock.UtcNow;
        var session = await db.phien_dang_nhaps.AsNoTracking().Include(x => x.ma_nguoi_dungNavigation)
            .SingleOrDefaultAsync(x => x.refresh_token_bam == hash, cancellationToken);
        if (session is null || session.thoi_diem_thu_hoi is not null || session.thoi_diem_het_han <= now
            || !session.ma_nguoi_dungNavigation.dang_hoat_dong)
        {
            throw new BusinessException(BusinessErrorCode.ThongTinDangNhapKhongDung);
        }

        var rotatedToken = TokenGenerator.GenerateOpaqueToken();
        var rotatedHash = TokenGenerator.HashToken(rotatedToken);
        var updated = await db.phien_dang_nhaps.Where(x => x.ma == session.ma && x.refresh_token_bam == hash
                && x.thoi_diem_thu_hoi == null && x.thoi_diem_het_han > now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.refresh_token_bam, rotatedHash)
                .SetProperty(x => x.lan_dung_cuoi, now), cancellationToken);
        if (updated != 1) throw new BusinessException(BusinessErrorCode.ThongTinDangNhapKhongDung);
        return CreateLoginResult(session.ma_nguoi_dungNavigation, rotatedToken, now, session.thoi_diem_het_han, session.ma);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var hash = TokenGenerator.HashToken(refreshToken);
        var now = clock.UtcNow;
        await db.phien_dang_nhaps.Where(x => x.refresh_token_bam == hash && x.thoi_diem_thu_hoi == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.thoi_diem_thu_hoi, now), cancellationToken);
    }

    public async Task ForgotPasswordAsync(string email, string? ipAddress, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email?.Trim() ?? string.Empty;
        if (!EmailValidator.IsValid(normalizedEmail))
        {
            throw new BusinessException(BusinessErrorCode.EmailKhongHopLe);
        }

        var now = clock.UtcNow;
        var user = await db.nguoi_dungs.SingleOrDefaultAsync(x => x.email == normalizedEmail && x.dang_hoat_dong, cancellationToken);
        var emailCount = await db.yeu_cau_dat_lai_mat_khaus.CountAsync(
            x => x.email == normalizedEmail && x.thoi_diem_yeu_cau >= now.AddHours(-1), cancellationToken);
        var ipCount = string.IsNullOrWhiteSpace(ipAddress) ? 0 : await db.yeu_cau_dat_lai_mat_khaus.CountAsync(
            x => x.ip_yeu_cau == ipAddress && x.thoi_diem_yeu_cau >= now.AddHours(-1), cancellationToken);

        db.yeu_cau_dat_lai_mat_khaus.Add(new yeu_cau_dat_lai_mat_khau
        {
            email = normalizedEmail,
            ma_nguoi_dung = user?.ma,
            ip_yeu_cau = Limit(ipAddress, 45),
            thoi_diem_yeu_cau = now
        });
        await db.SaveChangesAsync(cancellationToken);

        if (user is null || emailCount >= 3 || ipCount >= 10)
        {
            return;
        }

        var activeTokens = await db.token_dat_lai_mat_khaus
            .Where(x => x.ma_nguoi_dung == user.ma && x.trang_thai == TrangThaiTokenDatLai.Active)
            .ToListAsync(cancellationToken);
        foreach (var active in activeTokens)
        {
            active.trang_thai = TrangThaiTokenDatLai.Revoked;
            active.thoi_diem_thu_hoi = now;
        }

        var rawToken = TokenGenerator.GenerateOpaqueToken();
        db.token_dat_lai_mat_khaus.Add(new token_dat_lai_mat_khau
        {
            ma_nguoi_dung = user.ma,
            token_bam = TokenGenerator.HashToken(rawToken),
            trang_thai = TrangThaiTokenDatLai.Active,
            ngay_tao = now,
            thoi_diem_het_han = now.Add(ResetTokenLifetime),
            ip_yeu_cau = Limit(ipAddress, 45)
        });
        await db.SaveChangesAsync(cancellationToken);

        var resetUrl = $"{_options.PublicBaseUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(rawToken)}";
        await emailSender.SendAsync(new EmailMessage(user.email, "Đặt lại mật khẩu CoTuong Online",
            $"<p>Xin chào {System.Net.WebUtility.HtmlEncode(user.ten_hien_thi)},</p><p><a href=\"{resetUrl}\">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực trong 15 phút.</p>"), cancellationToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        if (!PasswordPolicy.IsValid(request.MatKhauMoi))
        {
            throw new BusinessException(BusinessErrorCode.MatKhauKhongDungQuyTac);
        }
        if (!string.Equals(request.MatKhauMoi, request.XacNhanMatKhauMoi, StringComparison.Ordinal))
        {
            throw new BusinessException(BusinessErrorCode.MatKhauXacNhanKhongKhop);
        }

        var now = clock.UtcNow;
        var tokenHash = TokenGenerator.HashToken(request.Token);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var token = await db.token_dat_lai_mat_khaus.AsNoTracking().Include(x => x.ma_nguoi_dungNavigation)
            .SingleOrDefaultAsync(x => x.token_bam == tokenHash, cancellationToken);
        if (token is null || token.trang_thai != TrangThaiTokenDatLai.Active || token.thoi_diem_het_han <= now
            || !token.ma_nguoi_dungNavigation.dang_hoat_dong)
        {
            throw new BusinessException(BusinessErrorCode.LinkDatLaiMatKhauKhongHieuLuc);
        }

        var used = await db.token_dat_lai_mat_khaus.Where(x => x.ma == token.ma
                && x.trang_thai == TrangThaiTokenDatLai.Active && x.thoi_diem_het_han > now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.trang_thai, TrangThaiTokenDatLai.Used)
                .SetProperty(x => x.thoi_diem_su_dung, now), cancellationToken);
        if (used != 1) throw new BusinessException(BusinessErrorCode.LinkDatLaiMatKhauKhongHieuLuc);
        var user = await db.nguoi_dungs.SingleAsync(x => x.ma == token.ma_nguoi_dung, cancellationToken);
        user.mat_khau_bam = passwordHasher.Hash(request.MatKhauMoi);
        user.thoi_diem_doi_mat_khau = now;
        var otherSessions = await db.phien_dang_nhaps.Where(x => x.ma_nguoi_dung == token.ma_nguoi_dung && x.thoi_diem_thu_hoi == null)
            .ToListAsync(cancellationToken);
        foreach (var session in otherSessions)
        {
            session.thoi_diem_thu_hoi = now;
        }
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private LoginResult CreateLoginResult(nguoi_dung user, string refreshToken, DateTime now, DateTime sessionExpiry, long sessionId)
    {
        if (Encoding.UTF8.GetByteCount(_options.SigningKey) < 32)
        {
            throw new InvalidOperationException("CoTuong:Jwt:SigningKey phải có ít nhất 32 byte.");
        }

        var accessExpiry = now.AddMinutes(_options.AccessTokenMinutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.ma.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.NameIdentifier, user.ma.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.Name, user.ten_dang_nhap),
            new Claim("display_name", user.ten_hien_thi)
        };
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(_options.Issuer, _options.Audience, claims, now, accessExpiry, credentials);
        return new LoginResult(user.ma, user.ten_dang_nhap, user.ten_hien_thi,
            new JwtSecurityTokenHandler().WriteToken(jwt), accessExpiry, refreshToken, sessionExpiry, sessionId);
    }

    private static void ValidateRegistration(RegisterRequest request)
    {
        if (!TenDangNhapValidator.IsValid(request.TenDangNhap)) throw new BusinessException(BusinessErrorCode.TenDangNhapKhongHopLe);
        if (!TenHienThiValidator.IsValid(request.TenHienThi)) throw new BusinessException(BusinessErrorCode.TenHienThiKhongHopLe);
        if (!EmailValidator.IsValid(request.Email)) throw new BusinessException(BusinessErrorCode.EmailKhongHopLe);
        if (!PasswordPolicy.IsValid(request.MatKhau)) throw new BusinessException(BusinessErrorCode.MatKhauKhongDungQuyTac);
        if (!string.Equals(request.MatKhau, request.XacNhanMatKhau, StringComparison.Ordinal))
            throw new BusinessException(BusinessErrorCode.MatKhauXacNhanKhongKhop);
    }

    private static TaiKhoanInfo ToAccountInfo(nguoi_dung user) => new(user.ma, user.ten_dang_nhap, user.ten_hien_thi, user.email);
    private static string? Limit(string? value, int maxLength) => value is null ? null : value[..Math.Min(value.Length, maxLength)];
}
