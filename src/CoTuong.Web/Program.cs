using CoTuong.Infrastructure.Persistence;
using CoTuong.Infrastructure.Services;
using CoTuong.Web.Components;
using Microsoft.EntityFrameworkCore;
using CoTuong.Core.Dtos;
using CoTuong.Core.Errors;
using CoTuong.Core.Abstractions;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using CoTuong.Web.Realtime;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Ha tang du lieu
// ---------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("CoTuongOnline")
    ?? throw new InvalidOperationException(
        "Thieu ConnectionStrings:CoTuongOnline. Kiem tra appsettings.Development.json.");

builder.Services.AddDbContext<CoTuongDbContext>(options =>
    options.UseSqlServer(connectionString, sql =>
    {
        sql.MigrationsAssembly(typeof(CoTuongDbContext).Assembly.FullName);
    }));

builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("CoTuong:Jwt"));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("CoTuong:Email"));
builder.Services.AddSingleton<CoTuong.Core.Abstractions.IClock, CoTuong.Infrastructure.Services.SystemClock>();
builder.Services.AddSingleton<CoTuong.Core.Abstractions.IPasswordHasher, AspNetPasswordHasher>();
if (string.Equals(builder.Configuration["CoTuong:Email:Provider"], "Smtp", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddTransient<CoTuong.Core.Abstractions.IEmailSender, SmtpEmailSender>();
else
    builder.Services.AddSingleton<CoTuong.Core.Abstractions.IEmailSender, FileEmailSender>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<FriendService>();
builder.Services.AddScoped<IRoomLockProvider, DatabaseRoomLockProvider>();
builder.Services.AddScoped<RoomService>();
builder.Services.AddScoped<RoomInvitationService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<CoTuong.Core.Abstractions.IIdempotencyStore, DatabaseIdempotencyStore>();
var jwtSigningKey = builder.Configuration["CoTuong:Jwt:SigningKey"] ?? string.Empty;
if (Encoding.UTF8.GetByteCount(jwtSigningKey) < 32)
    throw new InvalidOperationException("CoTuong:Jwt:SigningKey phải có ít nhất 32 byte.");

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = "CoTuongAuth";
        options.DefaultChallengeScheme = "CoTuongAuth";
        options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    })
    .AddPolicyScheme("CoTuongAuth", "Cookie hoặc JWT bearer", options =>
    {
        options.ForwardDefaultSelector = context =>
            context.Request.Headers.Authorization.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? JwtBearerDefaults.AuthenticationScheme
                : CookieAuthenticationDefaults.AuthenticationScheme;
    })
    .AddCookie(options =>
    {
        options.Cookie.Name = "CoTuong.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
        options.SlidingExpiration = false;
        options.Events.OnRedirectToLogin = context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            }
            context.Response.Redirect(context.RedirectUri);
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = async context =>
        {
            var sessionClaim = context.Principal?.FindFirst("session_id")?.Value;
            if (!long.TryParse(sessionClaim, out var sessionId))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }

            var db = context.HttpContext.RequestServices.GetRequiredService<CoTuongDbContext>();
            var now = context.HttpContext.RequestServices.GetRequiredService<IClock>().UtcNow;
            var active = await db.phien_dang_nhaps.AsNoTracking().AnyAsync(x => x.ma == sessionId
                && x.thoi_diem_thu_hoi == null && x.thoi_diem_het_han > now
                && x.ma_nguoi_dungNavigation.dang_hoat_dong);
            if (!active)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["CoTuong:Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["CoTuong:Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var sessionClaim = context.Principal?.FindFirst("session_id")?.Value;
                if (!long.TryParse(sessionClaim, out var sessionId))
                {
                    context.Fail("Access token không gắn với phiên hợp lệ.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<CoTuongDbContext>();
                var now = context.HttpContext.RequestServices.GetRequiredService<IClock>().UtcNow;
                var active = await db.phien_dang_nhaps.AsNoTracking().AnyAsync(x => x.ma == sessionId
                    && x.thoi_diem_thu_hoi == null && x.thoi_diem_het_han > now
                    && x.ma_nguoi_dungNavigation.dang_hoat_dong);
                if (!active) context.Fail("Phiên đăng nhập đã hết hiệu lực.");
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IRealtimeNotifier, SignalRRealtimeNotifier>();
builder.Services.AddHostedService<ConnectionLeaseCleanupService>();
builder.Services.AddHostedService<RoomInvitationExpiryService>();

// ---------------------------------------------------------------------------
// Blazor
// ---------------------------------------------------------------------------
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();
app.MapHub<RoomHub>("/hubs/room");

var auth = app.MapGroup("/api/auth");
auth.MapPost("/register", async (RegisterRequest request, HttpContext context, AuthService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () =>
        Results.Ok(await service.RegisterAsync(request,
            context.Request.Headers["Idempotency-Key"].FirstOrDefault(), ct))));
auth.MapPost("/login", async (LoginRequest request, HttpContext context, AuthService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () =>
    {
        var result = await service.LoginAsync(request, context.Request.Headers.UserAgent.ToString(), context.Connection.RemoteIpAddress?.ToString(), ct);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, result.MaNguoiDung.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.Name, result.TenDangNhap),
            new Claim("display_name", result.TenHienThi),
            new Claim("session_id", result.MaPhienDangNhap.ToString(System.Globalization.CultureInfo.InvariantCulture))
        };
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)),
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = result.RefreshTokenHetHan });
        context.Response.Cookies.Append("CoTuong.Refresh", result.RefreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = context.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/api/auth",
            Expires = result.RefreshTokenHetHan
        });
        return Results.Ok(new { result.MaNguoiDung, result.TenDangNhap, result.TenHienThi, result.AccessToken, result.AccessTokenHetHan });
    }));
auth.MapPost("/refresh", async (HttpContext context, AuthService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () =>
    {
        if (!context.Request.Cookies.TryGetValue("CoTuong.Refresh", out var refreshToken) || string.IsNullOrWhiteSpace(refreshToken))
            return Results.Unauthorized();
        var result = await service.RefreshAsync(refreshToken, ct);
        context.Response.Cookies.Append("CoTuong.Refresh", result.RefreshToken, new CookieOptions
        {
            HttpOnly = true, Secure = context.Request.IsHttps, SameSite = SameSiteMode.Strict,
            Path = "/api/auth", Expires = result.RefreshTokenHetHan
        });
        return Results.Ok(new { result.MaNguoiDung, result.TenDangNhap, result.TenHienThi, result.AccessToken, result.AccessTokenHetHan });
    }));
auth.MapPost("/logout", async (HttpContext context, AuthService service, CancellationToken ct) =>
{
    if (context.Request.Cookies.TryGetValue("CoTuong.Refresh", out var refreshToken))
        await service.LogoutAsync(refreshToken, ct);
    context.Response.Cookies.Delete("CoTuong.Refresh", new CookieOptions { Path = "/api/auth", SameSite = SameSiteMode.Strict, Secure = context.Request.IsHttps, HttpOnly = true });
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.NoContent();
});
auth.MapPost("/forgot-password", async (ForgotPasswordRequest request, HttpContext context, AuthService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () =>
    {
        await service.ForgotPasswordAsync(request.Email, context.Connection.RemoteIpAddress?.ToString(), ct);
        return Results.Ok(new { message = "Nếu email này được đăng ký trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email." });
    }));

var friends = app.MapGroup("/api/friends").RequireAuthorization();
friends.MapGet("/search", async (string q, HttpContext context, FriendService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(await service.SearchAsync(CurrentUserId(context), q, ct: ct))));
friends.MapGet("", async (HttpContext context, FriendService service, CancellationToken ct) =>
    Results.Ok(await service.ListFriendsAsync(CurrentUserId(context), ct)));
friends.MapGet("/requests", async (HttpContext context, FriendService service, CancellationToken ct) =>
    Results.Ok(await service.ListIncomingAsync(CurrentUserId(context), ct)));
friends.MapGet("/requests/sent", async (HttpContext context, FriendService service, CancellationToken ct) =>
    Results.Ok(await service.ListOutgoingAsync(CurrentUserId(context), ct)));
friends.MapPost("/requests", async (FriendRequestBody body, HttpContext context, FriendService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(new { requestId = await service.SendRequestAsync(CurrentUserId(context), body.UserId, ct) })));
friends.MapPost("/requests/{requestId:long}/accept", async (long requestId, HttpContext context, FriendService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.RespondAsync(CurrentUserId(context), requestId, true, ct); return Results.NoContent(); }));
friends.MapPost("/requests/{requestId:long}/reject", async (long requestId, HttpContext context, FriendService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.RespondAsync(CurrentUserId(context), requestId, false, ct); return Results.NoContent(); }));
friends.MapDelete("/requests/{requestId:long}", async (long requestId, HttpContext context, FriendService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.CancelRequestAsync(CurrentUserId(context), requestId, ct); return Results.NoContent(); }));
friends.MapDelete("/{friendId:long}", async (long friendId, HttpContext context, FriendService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.UnfriendAsync(CurrentUserId(context), friendId, ct); return Results.NoContent(); }));

var rooms = app.MapGroup("/api/rooms");
rooms.MapGet("/public", async (RoomService service, CancellationToken ct) => Results.Ok(await service.ListPublicAsync(ct)));
rooms.MapPost("", async (CreateRoomRequest request, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(await service.CreateAsync(CurrentUserId(context), request,
        context.Request.Headers["Idempotency-Key"].FirstOrDefault(), ct))))
    .RequireAuthorization();

var notifications = app.MapGroup("/api/notifications").RequireAuthorization();
notifications.MapGet("", async (HttpContext context, NotificationService service, CancellationToken ct) =>
    Results.Ok(await service.ListAsync(CurrentUserId(context), ct: ct)));
notifications.MapGet("/unread-count", async (HttpContext context, NotificationService service, CancellationToken ct) =>
    Results.Ok(new { count = await service.CountUnreadAsync(CurrentUserId(context), ct) }));
notifications.MapPost("/{notificationId:long}/read", async (long notificationId, HttpContext context, NotificationService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.MarkReadAsync(CurrentUserId(context), notificationId, ct); return Results.NoContent(); }));
rooms.MapPost("/join/code", async (JoinRoomByCodeRequest request, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(await service.JoinByCodeAsync(CurrentUserId(context), request.MaPhong, ct))))
    .RequireAuthorization();
rooms.MapPost("/join/public/{roomId:long}", async (long roomId, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(await service.JoinPublicAsync(CurrentUserId(context), roomId, ct))))
    .RequireAuthorization();
rooms.MapPost("/{roomId:long}/invites", async (long roomId, FriendRequestBody body, HttpContext context, RoomInvitationService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(new { inviteId = await service.SendAsync(CurrentUserId(context), roomId, body.UserId, ct) })))
    .RequireAuthorization();
rooms.MapPost("/invites/{inviteId:long}/accept", async (long inviteId, HttpContext context, RoomInvitationService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.RespondAsync(CurrentUserId(context), inviteId, true, ct); return Results.NoContent(); }))
    .RequireAuthorization();
rooms.MapPost("/invites/{inviteId:long}/decline", async (long inviteId, HttpContext context, RoomInvitationService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.RespondAsync(CurrentUserId(context), inviteId, false, ct); return Results.NoContent(); }))
    .RequireAuthorization();
rooms.MapPost("/invites/{inviteId:long}/cancel", async (long inviteId, HttpContext context, RoomInvitationService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.CancelAsync(CurrentUserId(context), inviteId, ct); return Results.NoContent(); }))
    .RequireAuthorization();
rooms.MapPost("/join/{token}", async (string token, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(await service.JoinByInviteTokenAsync(CurrentUserId(context), token, ct))))
    .RequireAuthorization();
rooms.MapGet("/{roomId:long}", async (long roomId, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(new { snapshot = await service.GetSnapshotAsync(roomId, CurrentUserId(context), ct), viewerId = CurrentUserId(context) })))
    .RequireAuthorization();
rooms.MapPost("/{roomId:long}/ready", async (long roomId, ReadyRequest request, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.SetReadyAsync(roomId, CurrentUserId(context), request.Ready, ct); return Results.NoContent(); }))
    .RequireAuthorization();
rooms.MapPost("/{roomId:long}/start", async (long roomId, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => Results.Ok(new { matchId = await service.StartMatchAsync(roomId, CurrentUserId(context),
        context.Request.Headers["Idempotency-Key"].FirstOrDefault(), ct) })))
    .RequireAuthorization();
rooms.MapPost("/{roomId:long}/opponent", async (long roomId, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.BecomeOpponentAsync(roomId, CurrentUserId(context), ct); return Results.NoContent(); }))
    .RequireAuthorization();
rooms.MapDelete("/{roomId:long}/opponent", async (long roomId, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.RemoveOpponentAsync(roomId, CurrentUserId(context), ct); return Results.NoContent(); }))
    .RequireAuthorization();
rooms.MapPost("/{roomId:long}/leave", async (long roomId, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.LeaveAsync(roomId, CurrentUserId(context), ct); return Results.NoContent(); }))
    .RequireAuthorization();
rooms.MapDelete("/{roomId:long}/members/{userId:long}", async (long roomId, long userId, HttpContext context, RoomService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () => { await service.KickAsync(roomId, CurrentUserId(context), userId, ct); return Results.NoContent(); }))
    .RequireAuthorization();
auth.MapPost("/reset-password", async (ResetPasswordRequest request, AuthService service, CancellationToken ct) =>
    await HandleBusinessAsync(async () =>
    {
        await service.ResetPasswordAsync(request, ct);
        return Results.Ok(new { message = "Đặt lại mật khẩu thành công." });
    }));

app.Run();

static async Task<IResult> HandleBusinessAsync(Func<Task<IResult>> action)
{
    try
    {
        return await action();
    }
    catch (BusinessException exception)
    {
        return Results.BadRequest(new { code = exception.MaLoi, message = exception.Message });
    }
}

static long CurrentUserId(HttpContext context)
{
    var value = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
    return long.TryParse(value, out var id) ? id : throw new UnauthorizedAccessException();
}

public sealed record RefreshRequest(string RefreshToken);
public sealed record FriendRequestBody(long UserId);
public sealed record ReadyRequest(bool Ready);
