using System.Text.Json;
using CoTuong.Core.Abstractions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace CoTuong.Infrastructure.Services;

public sealed class EmailOptions
{
    public string Provider { get; set; } = "File";
    public string OutputDirectory { get; set; } = "emails";
    public string SenderName { get; set; } = "CoTuong Online";
    public string SenderEmail { get; set; } = "no-reply@cotuong.local";
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string? SmtpUser { get; set; }
    public string? SmtpPassword { get; set; }
    public bool UseSsl { get; set; } = true;
}

/// <summary>Development sender that writes reset messages to a local outbox.</summary>
public sealed class FileEmailSender(IOptions<EmailOptions> options, IHostEnvironment environment) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var directory = Path.GetFullPath(Path.Combine(environment.ContentRootPath, options.Value.OutputDirectory));
        Directory.CreateDirectory(directory);
        var name = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.json";
        var path = Path.Combine(directory, name);
        var content = JsonSerializer.Serialize(message, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(path, content, cancellationToken);
    }
}
