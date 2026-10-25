using System.Net;
using System.Net.Mail;
using CoTuong.Core.Abstractions;
using Microsoft.Extensions.Options;

namespace CoTuong.Infrastructure.Services;

public sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var config = options.Value;
        if (string.IsNullOrWhiteSpace(config.SmtpHost))
            throw new InvalidOperationException("Cấu hình CoTuong:Email:SmtpHost đang để trống.");

        using var email = new MailMessage
        {
            From = new MailAddress(config.SenderEmail, config.SenderName),
            Subject = message.Subject,
            Body = message.Body,
            IsBodyHtml = true
        };
        email.To.Add(message.To);
        using var client = new SmtpClient(config.SmtpHost, config.SmtpPort)
        {
            EnableSsl = config.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false
        };
        if (!string.IsNullOrWhiteSpace(config.SmtpUser))
            client.Credentials = new NetworkCredential(config.SmtpUser, config.SmtpPassword);
        await client.SendMailAsync(email, cancellationToken);
    }
}
