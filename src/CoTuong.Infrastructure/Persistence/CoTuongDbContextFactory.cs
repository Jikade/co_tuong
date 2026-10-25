using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace CoTuong.Infrastructure.Persistence;

/// <summary>
/// Design-time factory cho <c>dotnet ef</c>.
///
/// <para>
/// EF Core can mot DbContext khi chay lenh CLI (scaffold/migration). Vi du an
/// co ha tang Web rieng, ta cung cap factory nay de <c>dotnet ef</c> khong phai
/// khoi dong toan bo host ASP.NET Core.</para>
///
/// <para>
/// Connection string duoc doc tu file <c>appsettings.Development.json</c> cua
/// project Web (duong dan tinh tu <c>CoTuong.Infrastructure</c> len goc repo).
/// Neu bien moi truong <c>CoTuong__ConnectionStrings__CoTuongOnline</c> duoc dat,
/// no se duoc uu tien.</para>
/// </summary>
public sealed class CoTuongDbContextFactory : IDesignTimeDbContextFactory<CoTuongDbContext>
{
    private const string DefaultConnectionString =
        "Server=IVANBROSKINAVA;Database=CoTuongOnline;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True";

    public CoTuongDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("CoTuong__ConnectionStrings__CoTuongOnline")
            ?? ReadConnectionStringFromWebAppSettings()
            ?? DefaultConnectionString;

        var options = new DbContextOptionsBuilder<CoTuongDbContext>()
            .UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsAssembly(typeof(CoTuongDbContext).Assembly.FullName);
            })
            .Options;

        return new CoTuongDbContext(options);
    }

    private static string? ReadConnectionStringFromWebAppSettings()
    {
        var path = LocateWebProjectDirectory();
        if (path is null)
        {
            return null;
        }

        var config = new ConfigurationBuilder()
            .SetBasePath(path)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        return config.GetConnectionString("CoTuongOnline") is { Length: > 0 } cs ? cs : null;
    }

    /// <summary>Di chuyen len goc repo (noi chua file CoTuong.slnx).</summary>
    private static string? LocateWebProjectDirectory()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);

        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "CoTuong.Web", "appsettings.Development.json");
            if (File.Exists(candidate))
            {
                return Path.Combine(dir.FullName, "src", "CoTuong.Web");
            }

            dir = dir.Parent;
        }

        return null;
    }
}
