using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using CoTuong.Core.Abstractions;
using CoTuong.Infrastructure.Persistence;

namespace CoTuong.Infrastructure.Services;

/// <summary>Cross-process SQL Server application lock scoped to one room.</summary>
public sealed class DatabaseRoomLockProvider(CoTuongDbContext db) : IRoomLockProvider
{
    public async Task<IAsyncDisposable> AcquireAsync(long maPhong, CancellationToken cancellationToken = default)
    {
        var connectionString = db.Database.GetConnectionString()
            ?? throw new InvalidOperationException("Không có connection string cho khóa Room.");
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "DECLARE @result int; EXEC @result = sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=10000; SELECT @result;";
        command.Parameters.Add(new SqlParameter("@resource", SqlDbType.NVarChar, 255) { Value = $"cotuong-room:{maPhong}" });
        var result = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken), System.Globalization.CultureInfo.InvariantCulture);
        if (result < 0)
        {
            await connection.DisposeAsync();
            throw new TimeoutException($"Không thể khóa Room {maPhong} trong thời gian cho phép.");
        }
        return new SqlRoomLock(connection, maPhong);
    }

    private sealed class SqlRoomLock(SqlConnection connection, long roomId) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = "EXEC sys.sp_releaseapplock @Resource=@resource, @LockOwner='Session';";
                command.Parameters.Add(new SqlParameter("@resource", SqlDbType.NVarChar, 255) { Value = $"cotuong-room:{roomId}" });
                await command.ExecuteNonQueryAsync();
            }
            finally
            {
                await connection.DisposeAsync();
            }
        }
    }
}
