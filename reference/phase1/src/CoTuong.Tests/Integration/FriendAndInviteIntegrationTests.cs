using CoTuong.Core.Abstractions;
using CoTuong.Core.Dtos;
using CoTuong.Core.Enums;
using CoTuong.Core.Errors;
using CoTuong.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CoTuong.Tests.Integration;

public class FriendAndInviteIntegrationTests
{
    [Fact]
    public async Task Friend_request_accept_creates_single_relationship()
    {
        await using var h = new TestHarness();
        var alice = h.SeedUser("alice");
        var bob = h.SeedUser("bob");

        var requestId = await h.FriendService.SendRequestAsync(alice.ma, bob.ma);
        await h.FriendService.RespondAsync(bob.ma, requestId, accept: true);

        Assert.Equal(1, await h.Db.ban_bes.CountAsync());
        Assert.True(h.Notifier.HasEvent(RealtimeEvent.NotificationReceived));
        var relationship = await h.Db.ban_bes.SingleAsync();
        Assert.Equal(alice.ma, relationship.ma_nguoi_dung_nho);
        Assert.Equal(bob.ma, relationship.ma_nguoi_dung_lon);
    }

    [Fact]
    public async Task Friend_request_accept_twice_still_single_relationship()
    {
        await using var h = new TestHarness();
        var alice = h.SeedUser("alice");
        var bob = h.SeedUser("bob");

        var requestId = await h.FriendService.SendRequestAsync(alice.ma, bob.ma);
        await h.FriendService.RespondAsync(bob.ma, requestId, accept: true);
        Assert.Equal(1, await h.Db.ban_bes.CountAsync());

        // Nhan "Chap nhan" lan 2 (vi du 2 tab cuan bob, hoac ban tro lai trang):
        // loi moi da duoc xu ly => bao loi nghiep vu, khong tao quan he thu 2.
        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => h.FriendService.RespondAsync(bob.ma, requestId, accept: true));
        Assert.Equal(BusinessErrorCode.LoiMoiDaDuocXuLy, ex.MaLoi);
        Assert.Equal(1, await h.Db.ban_bes.CountAsync());
    }

    [Fact]
    public async Task Friend_request_cancel_marks_canceled_and_rejects_second_attempt()
    {
        await using var h = new TestHarness();
        var alice = h.SeedUser("alice");
        var bob = h.SeedUser("bob");

        var requestId = await h.FriendService.SendRequestAsync(alice.ma, bob.ma);
        await h.FriendService.CancelRequestAsync(alice.ma, requestId);

        var request = await h.Db.loi_moi_ket_bans.SingleAsync(x => x.ma == requestId);
        Assert.Equal(TrangThaiLoiMoiKetBan.Cancelled, request.trang_thai);

        // Cancel again: rowcount = 0 -> already processed (not 500, not "not found").
        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => h.FriendService.CancelRequestAsync(alice.ma, requestId));
        Assert.Equal(BusinessErrorCode.LoiMoiDaDuocXuLy, ex.MaLoi);
    }

    [Fact]
    public async Task Room_invite_from_non_host_throws()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var intruder = h.SeedUser("khong_phai_chu");
        var room = h.SeedRoom(host.ma);
        h.MakeFriends(host.ma, intruder.ma);
        h.MakeOnline(intruder.ma);

        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => h.Invitations.SendAsync(intruder.ma, room.ma, host.ma));
        Assert.Equal(BusinessErrorCode.KhongPhaiChuRoom, ex.MaLoi);
    }

    [Fact]
    public async Task Room_invite_to_offline_friend_throws_with_reason()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var offlineFriend = h.SeedUser("ban_offline");
        var room = h.SeedRoom(host.ma);
        h.MakeFriends(host.ma, offlineFriend.ma);
        // khong MakeOnline(offlineFriend.ma) — doi tac offline.

        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => h.Invitations.SendAsync(host.ma, room.ma, offlineFriend.ma));
        Assert.Equal(BusinessErrorCode.NguoiChoiDangOffline, ex.MaLoi);
    }

    [Fact]
    public async Task Room_invite_expire_due_marks_pending_invite_expired()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var friend = h.SeedUser("ban_be");
        var room = h.SeedRoom(host.ma);
        h.MakeFriends(host.ma, friend.ma);
        h.MakeOnline(friend.ma);

        var inviteId = await h.Invitations.SendAsync(host.ma, room.ma, friend.ma);
        h.Clock.Advance(TimeSpan.FromSeconds(61));

        var expired = await h.Invitations.ExpireDueAsync();
        Assert.Equal(1, expired);
        var invite = await h.Db.loi_moi_vao_phongs.SingleAsync(x => x.ma == inviteId);
        Assert.Equal(TrangThaiLoiMoiVaoPhong.Expired, invite.trang_thai);
    }

    [Fact]
    public async Task Room_invite_accept_joins_invitee_as_spectator_or_opponent()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var friend = h.SeedUser("ban_be");
        var room = h.SeedRoom(host.ma);
        h.MakeFriends(host.ma, friend.ma);
        h.MakeOnline(friend.ma);

        var inviteId = await h.Invitations.SendAsync(host.ma, room.ma, friend.ma);
        await h.Invitations.RespondAsync(friend.ma, inviteId, accept: true);

        // Room dang cho doi thu (chua co ai o vi tri do) -> doi tac duoc vao la Opponent.
        var role = await h.Db.thanh_vien_phongs.SingleAsync(m => m.ma_phong == room.ma && m.ma_nguoi_dung == friend.ma);
        Assert.Equal(VaiTro.Opponent, role.vai_tro);
        Assert.True(h.Notifier.HasEvent(RealtimeEvent.MemberJoined));
    }

    [Fact]
    public async Task Room_invite_decline_notifies_host()
    {
        await using var h = new TestHarness();
        var host = h.SeedUser("chu_phong");
        var friend = h.SeedUser("ban_be");
        var room = h.SeedRoom(host.ma);
        h.MakeFriends(host.ma, friend.ma);
        h.MakeOnline(friend.ma);

        var inviteId = await h.Invitations.SendAsync(host.ma, room.ma, friend.ma);
        await h.Invitations.RespondAsync(friend.ma, inviteId, accept: false);

        var invite = await h.Db.loi_moi_vao_phongs.SingleAsync(x => x.ma == inviteId);
        Assert.Equal(TrangThaiLoiMoiVaoPhong.Declined, invite.trang_thai);
        Assert.Equal(1, await h.Db.thong_baos.CountAsync(x => x.ma_nguoi_dung == host.ma));
    }
}
