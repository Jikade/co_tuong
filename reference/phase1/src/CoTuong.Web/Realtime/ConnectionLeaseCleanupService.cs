using CoTuong.Core.Abstractions;
using CoTuong.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Web.Realtime;

public sealed class ConnectionLeaseCleanupService(IServiceScopeFactory scopeFactory, IClock clock, ILogger<ConnectionLeaseCleanupService> logger)
    : BackgroundService
{
    private static readonly TimeSpan Lease = TimeSpan.FromSeconds(60);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(20));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<CoTuongDbContext>();
                var now = clock.UtcNow;
                var cutoff = now.Subtract(Lease);
                await db.ket_noi_nguoi_dungs.Where(x => x.thoi_diem_ngat_ket_noi == null && x.lan_thay_cuoi < cutoff)
                    .ExecuteUpdateAsync(update => update.SetProperty(x => x.thoi_diem_ngat_ket_noi, now), stoppingToken);
                await db.token_dat_lai_mat_khaus.Where(x => x.trang_thai == CoTuong.Core.Enums.TrangThaiTokenDatLai.Active
                    && x.thoi_diem_het_han <= now)
                    .ExecuteUpdateAsync(update => update.SetProperty(x => x.trang_thai, CoTuong.Core.Enums.TrangThaiTokenDatLai.Expired), stoppingToken);
                await db.ket_noi_nguoi_dungs.Where(x => x.thoi_diem_ngat_ket_noi < now.AddHours(-1))
                    .ExecuteDeleteAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Dọn các kết nối Room hết lease thất bại.");
            }
        }
    }
}
