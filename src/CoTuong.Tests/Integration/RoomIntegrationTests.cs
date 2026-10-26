using CoTuong.Core.Dtos;
using CoTuong.Core.Errors;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CoTuong.Tests.Integration;

public class RoomIntegrationTests
{
    [Fact]
    public async Task CreateRoom_twice_with_same_idempotency_key_returns_same_room()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");

        var first = await h.RoomService.CreateAsync(host.ma, new CreateRoomRequest("Phong A", "Public"), idempotencyKey: "k1");
        var second = await h.RoomService.CreateAsync(host.ma, new CreateRoomRequest("Phong A", "Public"), idempotencyKey: "k1");

        Assert.Equal(first.MaPhong, second.MaPhong);
        Assert.Equal(1, await h.Db.phongs.CountAsync());
        // host la thanh vien (role Host) cua room.
        var snapshot = await h.RoomService.GetSnapshotAsync(first.MaPhong, host.ma);
        Assert.Equal(first.MaPhong, snapshot.MaPhong);
    }

    [Fact]
    public async Task CreateRoom_invalid_name_throws()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        await Assert.ThrowsAsync<BusinessException>(
            () => h.RoomService.CreateAsync(host.ma, new CreateRoomRequest(" ", "Public")));
    }

    [Fact]
    public async Task Join_by_code_assigns_opponent_role_when_room_waiting()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var opponent = h.SeedUser("doi_thu");
        var room = h.SeedRoom(host.ma);

        var snapshot = await h.RoomService.JoinByCodeAsync(opponent.ma, room.ma_so_phong);
        // host + moi ngui moi vao = vai tro Opponent (khong co match dang doi).
        var role = await h.Db.thanh_vien_phongs.SingleAsync(m => m.ma_phong == room.ma && m.ma_nguoi_dung == opponent.ma);
        Assert.Equal(CoTuong.Core.Enums.VaiTro.Opponent, role.vai_tro);
        Assert.Equal(opponent.ma, snapshot.MaDoiThu);
    }

    [Fact]
    public async Task Join_closed_room_throws_room_unavailable()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var visitor = h.SeedUser("nguoi_dau");
        var room = h.SeedRoom(host.ma);
        room.trang_thai = CoTuong.Core.Enums.TrangThaiPhong.Closed;
        h.Db.SaveChanges();

        await Assert.ThrowsAsync<BusinessException>(
            () => h.RoomService.JoinByCodeAsync(visitor.ma, room.ma_so_phong));
    }

    [Fact]
    public async Task Banned_user_cannot_rejoin_room()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var kicked = h.SeedUser("bi_da");
        var room = h.SeedRoom(host.ma);
        h.SeedMember(room.ma, kicked.ma, CoTuong.Core.Enums.VaiTro.Spectator);

        await h.RoomService.KickAsync(room.ma, host.ma, kicked.ma); // Kick da tao cam_vao_phong.

        await Assert.ThrowsAsync<BusinessException>(
            () => h.RoomService.JoinByCodeAsync(kicked.ma, room.ma_so_phong));
    }

    [Fact]
    public async Task Leave_by_host_closes_room_when_no_one_else()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var room = h.SeedRoom(host.ma);

        await h.RoomService.LeaveAsync(room.ma, host.ma);

        var updated = await h.Db.phongs.SingleAsync(x => x.ma == room.ma);
        Assert.Equal(CoTuong.Core.Enums.TrangThaiPhong.Closed, updated.trang_thai);
        Assert.True(h.Notifier.HasEvent(CoTuong.Core.Abstractions.RealtimeEvent.RoomClosed));
    }

    [Fact]
    public async Task Leave_by_host_transfers_host_to_first_other_member()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var keeper = h.SeedUser("nguoi_lai");
        var room = h.SeedRoom(host.ma);
        h.SeedMember(room.ma, keeper.ma, CoTuong.Core.Enums.VaiTro.Spectator);

        await h.RoomService.LeaveAsync(room.ma, host.ma);

        var newHost = await h.Db.thanh_vien_phongs.SingleAsync(
            m => m.ma_phong == room.ma && m.ma_nguoi_dung == keeper.ma && m.thoi_diem_roi == null);
        Assert.Equal(CoTuong.Core.Enums.VaiTro.Host, newHost.vai_tro);
        Assert.True(h.Notifier.HasEvent(CoTuong.Core.Abstractions.RealtimeEvent.HostTransferred));
    }

    [Fact]
    public async Task StartMatch_without_ready_opponent_throws()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var opponent = h.SeedUser("doi_thu");
        var room = h.SeedRoom(host.ma);
        h.SeedMember(room.ma, opponent.ma, CoTuong.Core.Enums.VaiTro.Opponent, ready: false);

        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => h.RoomService.StartMatchAsync(room.ma, host.ma));
        Assert.Equal(CoTuong.Core.Errors.BusinessErrorCode.ChuaSanSang, ex.MaLoi);
    }

    [Fact]
    public async Task StartMatch_replaying_same_idempotency_key_returns_existing_match()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var opponent = h.SeedUser("doi_thu");
        var room = h.SeedRoom(host.ma);
        h.SeedMember(room.ma, opponent.ma, CoTuong.Core.Enums.VaiTro.Opponent, ready: true);

        // Seeding mot Match dang di se lan tron phan "existing" (tr truoc
        // stored proc — mo pho duoc o InMemory).
        h.Db.tran_daus.Add(new CoTuong.Infrastructure.Entities.tran_dau
        {
            loai_tran = "PvP",
            ma_phong = room.ma,
            ma_nguoi_tao = host.ma,
            ma_nguoi_choi_do = host.ma,
            ma_nguoi_choi_den = opponent.ma,
            trang_thai = "Countdown",
            ben_den_luot = "Red",
            so_nuoc_di = 0,
            phien_ban_trang_thai = 0,
            ngay_tao = h.Clock.UtcNow,
            thoi_diem_bat_dau_dem_nguoc = h.Clock.UtcNow
        });
        h.Db.SaveChanges();
        var matchId = h.Db.tran_daus.Single().ma;

        var result = await h.RoomService.StartMatchAsync(room.ma, host.ma, idempotencyKey: "start-1");
        Assert.Equal(matchId, result);
        Assert.Single(h.Db.tran_daus); // khong tao Match thu hai
    }

    [Fact]
    public async Task BecomeOpponent_when_slot_free_moves_spectator_to_opponent()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var spect = h.SeedUser("nhan_gia");
        var room = h.SeedRoom(host.ma);
        var member = h.SeedMember(room.ma, spect.ma, CoTuong.Core.Enums.VaiTro.Spectator);

        await h.RoomService.BecomeOpponentAsync(room.ma, spect.ma);

        member = await h.Db.thanh_vien_phongs.SingleAsync(m => m.ma == member.ma);
        Assert.Equal(CoTuong.Core.Enums.VaiTro.Opponent, member.vai_tro);
    }
}
