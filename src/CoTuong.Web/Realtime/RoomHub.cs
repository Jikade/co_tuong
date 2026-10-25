using System.Security.Claims;
using CoTuong.Core.Abstractions;
using CoTuong.Infrastructure.Entities;
using CoTuong.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Web.Realtime;

[Authorize]
public sealed class RoomHub(CoTuongDbContext db, IClock clock) : Hub
{
    public async Task JoinRoom(long roomId)
    {
        var userId = GetUserId();
        var isMember = await db.thanh_vien_phongs.AnyAsync(x => x.ma_phong == roomId
            && x.ma_nguoi_dung == userId && x.thoi_diem_roi == null);
        if (!isMember) throw new HubException("Bạn không còn ở trong Room này.");
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroup(roomId));
    }

    public Task LeaveRoom(long roomId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(roomId));

    public async Task Heartbeat()
    {
        var connection = await db.ket_noi_nguoi_dungs.SingleOrDefaultAsync(x => x.ma_ket_noi == Context.ConnectionId
            && x.thoi_diem_ngat_ket_noi == null);
        if (connection is null) return;
        connection.lan_thay_cuoi = clock.UtcNow;
        await db.SaveChangesAsync();
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        var now = clock.UtcNow;
        db.ket_noi_nguoi_dungs.Add(new ket_noi_nguoi_dung
        {
            ma_nguoi_dung = userId,
            ma_ket_noi = Context.ConnectionId,
            thoi_diem_ket_noi = now,
            lan_thay_cuoi = now
        });
        await db.SaveChangesAsync();
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connection = await db.ket_noi_nguoi_dungs.SingleOrDefaultAsync(x => x.ma_ket_noi == Context.ConnectionId
            && x.thoi_diem_ngat_ket_noi == null);
        if (connection is not null)
        {
            connection.thoi_diem_ngat_ket_noi = clock.UtcNow;
            await db.SaveChangesAsync();
        }
        await base.OnDisconnectedAsync(exception);
    }

    private long GetUserId()
    {
        var value = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(value, out var id) ? id : throw new HubException("Phiên đăng nhập không hợp lệ.");
    }

    public static string RoomGroup(long roomId) => $"room:{roomId}";
}
