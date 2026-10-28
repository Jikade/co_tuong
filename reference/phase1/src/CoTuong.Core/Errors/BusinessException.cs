namespace CoTuong.Core.Errors;

/// <summary>
/// Loi nghiep vu duoc mo hinh that yeu cu (khong co thuc su loi he thong).
/// Mang ma loi de client an xua duoc thong bao tieng Viet duy nhat.
/// </summary>
/// <param name="maLoi">Ma loi nghiep vu (xem <see cref="BusinessErrorCode"/>).</param>
public sealed class BusinessException : Exception
{
    public BusinessException(string maLoi)
        : this(maLoi, null)
    {
    }

    public BusinessException(string maLoi, Exception? innerException)
        : base(BusinessErrorMessages.Get(maLoi), innerException)
    {
        MaLoi = maLoi;
    }

    /// <summary>Ma loi nghiep vu (an xua vao thong diep tieng Viet).</summary>
    public string MaLoi { get; }
}
