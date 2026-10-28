namespace CoTuong.Core.Abstractions;

/// <summary>Tin nhan can gui qua email.</summary>
/// <param name="To">Dia chi nhan.</param>
/// <param name="Subject">Tieu de.</param>
/// <param name="Body">Noi dung (HTML).</param>
public sealed record EmailMessage(string To, string Subject, string Body);

/// <summary>
/// Gui email. Hien thuc mac dinh la <c>FileEmailSender</c> (ghi file ra thu muc
/// <c>emails/</c>) de co the test duoc luong dat lai mat khau ma can cau hinh
/// SMTP that. README (muc 2.1) yeu cau gui link dat lai mat khau qua email.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
