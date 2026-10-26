using CoTuong.Core.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace CoTuong.Web.Realtime;

public sealed class SignalRRealtimeNotifier(IHubContext<RoomHub> hub) : IRealtimeNotifier
{
    public Task RoomAsync(long maPhong, string tenSuKien, object? duLieu = null, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(RoomHub.RoomGroup(maPhong)).SendAsync(tenSuKien, duLieu, cancellationToken);

    public Task UserAsync(long maNguoiDung, string tenSuKien, object? duLieu = null, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(RoomHub.UserGroup(maNguoiDung)).SendAsync(tenSuKien, duLieu, cancellationToken);

    public Task PublicRoomsChangedAsync(CancellationToken cancellationToken = default) =>
        hub.Clients.All.SendAsync(RealtimeEvent.PublicRoomsChanged, cancellationToken);
}
