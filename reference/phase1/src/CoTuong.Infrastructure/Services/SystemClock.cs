using CoTuong.Core.Abstractions;

namespace CoTuong.Infrastructure.Services;

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
