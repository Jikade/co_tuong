using CoTuong.Infrastructure.Services;

namespace CoTuong.Web.Realtime;

public sealed class RoomInvitationExpiryService(IServiceScopeFactory scopeFactory, ILogger<RoomInvitationExpiryService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var invitations = scope.ServiceProvider.GetRequiredService<RoomInvitationService>();
                await invitations.ExpireDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Quét lời mời Room hết hạn thất bại.");
            }
        }
    }
}
