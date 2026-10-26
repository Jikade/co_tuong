using CoTuong.Core.Dtos;
using CoTuong.Core.Errors;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CoTuong.Tests.Integration;

public class AuthIntegrationTests
{
    [Fact]
    public async Task Register_duplicate_username_throws_business_error()
    {
        await using var h = new TestHarness();
        h.SeedUser("vanhoa");
        await Assert.ThrowsAsync<BusinessException>(() =>
            h.AuthService.RegisterAsync(new RegisterRequest("vanhoa", "VanHoa", "a@b.co", "MatKhau@123", "MatKhau@123")));
    }

    [Fact]
    public async Task Register_same_idempotency_key_returns_same_user_not_new_one()
    {
        await using var h = new TestHarness();
        var request = new RegisterRequest("anhvu", "AnHvu", "anhvu@test.local", "MatKhau@123", "MatKhau@123");
        var first = await h.AuthService.RegisterAsync(request, idempotencyKey: "same-key");
        var second = await h.AuthService.RegisterAsync(request, idempotencyKey: "same-key");

        Assert.Equal(first.MaNguoiDung, second.MaNguoiDung);
        Assert.Equal(1, await h.Db.nguoi_dungs.CountAsync()); // chi tao mot tai khoan
    }

    [Fact]
    public async Task Register_rejects_reusing_idempotency_key_with_different_payload()
    {
        await using var h = new TestHarness();
        await h.AuthService.RegisterAsync(
            new RegisterRequest("anhvu", "AnHvu", "anhvu@test.local", "MatKhau@123", "MatKhau@123"),
            idempotencyKey: "same-key");

        var error = await Assert.ThrowsAsync<BusinessException>(() => h.AuthService.RegisterAsync(
            new RegisterRequest("khac", "Khac", "khac@test.local", "MatKhau@123", "MatKhau@123"),
            idempotencyKey: "same-key"));

        Assert.Equal(BusinessErrorCode.ThaoTacKhongHopLe, error.MaLoi);
        Assert.Equal(1, await h.Db.nguoi_dungs.CountAsync());
    }

    [Fact]
    public async Task Login_creates_session_and_refresh_rotates_token()
    {
        await using var h = new TestHarness();
        var user = h.SeedUser("linh");
        var login = await h.AuthService.LoginAsync(new LoginRequest("linh", "CoTuong@2026"));
        Assert.Equal(user.ma, login.MaNguoiDung);

        var refreshed = await h.AuthService.RefreshAsync(login.RefreshToken);
        Assert.NotEqual(login.RefreshToken, refreshed.RefreshToken);

        // Token cu phai bi bao loi (rotation) — khong dung lai duoc.
        await Assert.ThrowsAsync<BusinessException>(() => h.AuthService.RefreshAsync(login.RefreshToken));
    }

    [Fact]
    public async Task ForgotPassword_blocks_email_over_rate_limit_but_logs_every_request()
    {
        await using var h = new TestHarness();
        var user = h.SeedUser("quyen");

        // gioi han: < 3 lan/email trong 1h moi gui email. Goi 4 lan: 3 lan dau
        // van gui email (count 1..3), lan 4 bi chan (count = 4 > 3).
        for (var i = 0; i < 3; i++)
            await h.AuthService.ForgotPasswordAsync(user.email, "1.2.3.4");
        Assert.Equal(3, h.Emails.Sent.Count);

        await h.AuthService.ForgotPasswordAsync(user.email, "1.2.3.4");
        Assert.Equal(3, h.Emails.Sent.Count);          // lan 4: chua gui email
        Assert.Equal(4, await h.Db.yeu_cau_dat_lai_mat_khaus.CountAsync()); // nhat ky van ghi
    }

    [Fact]
    public async Task ForgotPassword_unknown_email_logs_but_sends_nothing()
    {
        await using var h = new TestHarness();
        await h.AuthService.ForgotPasswordAsync("khongtontai@test.local", "1.2.3.4");
        Assert.Empty(h.Emails.Sent);
        // ma_nguoi_dung = null (khong lo thong tin tai khoan co ton tai khong).
        Assert.Null(h.Db.yeu_cau_dat_lai_mat_khaus.Single().ma_nguoi_dung);
    }

    [Fact]
    public async Task ResetPassword_with_valid_token_updates_password_and_revokes_sessions()
    {
        await using var h = new TestHarness();
        var user = h.SeedUser("mai");
        var session = await h.AuthService.LoginAsync(new LoginRequest("mai", "CoTuong@2026"));

        await h.AuthService.ForgotPasswordAsync(user.email, "9.9.9.9");
        var sent = h.Emails.Sent.Single();
        var rawToken = System.Text.RegularExpressions.Regex.Match(sent.Body, @"token=([^&""<]+)").Groups[1].Value;
        Assert.True(rawToken.Length > 0);

        await h.AuthService.ResetPasswordAsync(new ResetPasswordRequest(rawToken, "MatKhauMoi@1", "MatKhauMoi@1"));

        var updated = await h.Db.nguoi_dungs.FirstAsync(x => x.ma == user.ma);
        Assert.True(h.Hasher.Verify("MatKhauMoi@1", updated.mat_khau_bam));
        // tat ca session da bi thu hoi.
        Assert.All(h.Db.phien_dang_nhaps, x => Assert.NotNull(x.thoi_diem_thu_hoi));

        // Token chi duoc dung 1 lan.
        await Assert.ThrowsAsync<BusinessException>(() =>
            h.AuthService.ResetPasswordAsync(new ResetPasswordRequest(rawToken, "MatKhau2@1", "MatKhau2@1")));
    }
}
