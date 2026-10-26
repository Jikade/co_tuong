using CoTuong.Core.Abstractions;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using CoTuong.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;

namespace CoTuong.Tests.Integration;

/// <summary>
/// Harness cho integration test Phase 1: DbContext InMemory + cac gia niem
/// (clock, notifier, email, room lock) de test business services ma khong
/// can SQL Server that.
/// </summary>
public sealed class TestHarness : IAsyncDisposable
{
    private readonly string _dbName;

    public CoTuongDbContext Db { get; }
    public FakeClock Clock { get; } = new();
    public FakeNotifier Notifier { get; }
    public FakeEmailSender Emails { get; }
    public InMemoryRoomLocks Locks { get; }
    public AspNetPasswordHasher Hasher { get; } = new();
    public AuthService AuthService { get; }
    public FriendService FriendService { get; }
    public RoomService RoomService { get; }
    public RoomInvitationService Invitations { get; }
    public NotificationService Notifications { get; }

    public TestHarness()
    {
        _dbName = Guid.NewGuid().ToString("N");
        var options = new DbContextOptionsBuilder<CoTuongDbContext>()
            .UseInMemoryDatabase(_dbName)
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        Db = new CoTuongDbContext(options);
        Notifier = new FakeNotifier();
        Emails = new FakeEmailSender();
        Locks = new InMemoryRoomLocks();
        AuthService = new AuthService(Db, Clock, Hasher, Emails,
            Options.Create(new AuthOptions
            {
                SigningKey = new string('k', 64),
                PublicBaseUrl = "https://localhost:7080"
            }));
        FriendService = new FriendService(Db, Clock, Notifier);
        RoomService = new RoomService(Db, Clock, Locks, Notifier);
        Invitations = new RoomInvitationService(Db, Clock, Locks, Notifier);
        Notifications = new NotificationService(Db, Clock);
    }

    // ----- Seed helpers --------------------------------------------------

    public nguoi_dung SeedUser(string username, string password = "CoTuong@2026")
    {
        var user = new nguoi_dung
        {
            ten_dang_nhap = username,
            ten_hien_thi = username,
            email = $"{username.ToLowerInvariant()}@test.local",
            mat_khau_bam = Hasher.Hash(password),
            dang_hoat_dong = true,
            thoi_diem_doi_mat_khau = Clock.UtcNow
        };
        Db.nguoi_dungs.Add(user);
        Db.SaveChanges();
        return user;
    }

    /// <summary>Gia niem view v_nguoi_dung_online: mot ngui duoc coi online.</summary>
    public void MakeOnline(long userId)
    {
        var user = Db.nguoi_dungs.AsNoTracking().First(x => x.ma == userId);
        Db.v_nguoi_dung_onlines.Add(new v_nguoi_dung_online
        {
            ma_nguoi_dung = userId,
            ten_dang_nhap = user.ten_dang_nhap,
            ten_hien_thi = user.ten_hien_thi,
            dang_online = true
        });
        Db.SaveChanges();
    }

    public void MakeFriends(long a, long b)
    {
        Db.ban_bes.Add(new ban_be
        {
            ma_nguoi_dung_nho = Math.Min(a, b),
            ma_nguoi_dung_lon = Math.Max(a, b),
            ma_loi_moi_nguon = 0,
            ngay_tao = Clock.UtcNow
        });
        Db.SaveChanges();
    }

    /// <summary>Tao Room cong khai + mot thanh vien Host.</summary>
    public phong SeedRoom(long hostId, string name = "Room Test")
    {
        var now = Clock.UtcNow;
        var room = new phong
        {
            ma_so_phong = Random.Shared.Next(100_000, 1_000_000).ToString(System.Globalization.CultureInfo.InvariantCulture),
            token_moi = Guid.NewGuid().ToString("N"),
            ten = name,
            che_do_hien_thi = CoTuong.Core.Enums.CheDoHienThi.Public,
            trang_thai = CoTuong.Core.Enums.TrangThaiPhong.WaitingOpponent,
            so_khan_gia_toi_da = 3,
            ma_nguoi_tao = hostId,
            ngay_tao = now
        };
        Db.phongs.Add(room);
        Db.thanh_vien_phongs.Add(new thanh_vien_phong
        {
            ma_phong = room.ma,
            ma_nguoi_dung = hostId,
            vai_tro = CoTuong.Core.Enums.VaiTro.Host,
            san_sang = false,
            thoi_diem_vao = now,
            thoi_diem_nhan_vai_tro = now,
            nguon_tham_gia = "Seed"
        });
        Db.SaveChanges();
        return room;
    }

    public thanh_vien_phong SeedMember(long roomId, long userId, string role, bool ready = false)
    {
        var now = Clock.UtcNow;
        var member = new thanh_vien_phong
        {
            ma_phong = roomId,
            ma_nguoi_dung = userId,
            vai_tro = role,
            san_sang = ready,
            thoi_diem_vao = now,
            thoi_diem_nhan_vai_tro = now,
            nguon_tham_gia = "Seed"
        };
        Db.thanh_vien_phongs.Add(member);
        Db.SaveChanges();
        return member;
    }

    public async ValueTask DisposeAsync()
    {
        await Db.Database.EnsureDeletedAsync();
        await Db.DisposeAsync();
    }
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/// <summary>Dong ho gia niem — mo pho duoc thoi gian (loi moi 60s, token 15 phut).</summary>
public sealed class FakeClock : IClock
{
    public DateTime UtcNow { get; set; } = new(2026, 1, 15, 10, 0, 0, DateTimeKind.Utc);
    public void Advance(TimeSpan duration) => UtcNow += duration;
}

public sealed class FakeNotifier : IRealtimeNotifier
{
    public sealed record Event(long? Room, long? User, string Name, object? Payload);
    public List<Event> Sent { get; } = [];

    public Task RoomAsync(long maPhong, string tenSuKien, object? duLieu = null, CancellationToken ct = default)
    { Sent.Add(new Event(maPhong, null, tenSuKien, duLieu)); return Task.CompletedTask; }

    public Task UserAsync(long maNguoiDung, string tenSuKien, object? duLieu = null, CancellationToken ct = default)
    { Sent.Add(new Event(null, maNguoiDung, tenSuKien, duLieu)); return Task.CompletedTask; }

    public Task PublicRoomsChangedAsync(CancellationToken ct = default)
    { Sent.Add(new Event(null, null, RealtimeEvent.PublicRoomsChanged, null)); return Task.CompletedTask; }

    public bool HasEvent(string name) => Sent.Any(x => x.Name == name);
}

public sealed class FakeEmailSender : IEmailSender
{
    public List<EmailMessage> Sent { get; } = [];
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    { Sent.Add(message); return Task.CompletedTask; }
}

/// <summary>
/// Room lock trong bo nho (moi Room mot SemaphoreSlim) — mo pho
/// <c>DatabaseRoomLockProvider</c> cho test InMemory.
/// </summary>
public sealed class InMemoryRoomLocks : IRoomLockProvider
{
    private readonly ConcurrentDictionary<long, SemaphoreSlim> _locks = new();

    public Task<IAsyncDisposable> AcquireAsync(long maPhong, CancellationToken cancellationToken = default)
    {
        var semaphore = _locks.GetOrAdd(maPhong, _ => new SemaphoreSlim(1));
        semaphore.Wait(cancellationToken);
        return Task.FromResult<IAsyncDisposable>(new Release(semaphore));
    }

    private sealed class Release(SemaphoreSlim semaphore) : IAsyncDisposable
    {
        public ValueTask DisposeAsync()
        {
            semaphore.Release();
            return ValueTask.CompletedTask;
        }
    }
}
