namespace CoTuong.Core.Abstractions;

/// <summary>
/// Bam mat khau. Chi luu hash trong DB (cot <c>mat_khau_bam</c>, NVARCHAR(255)),
/// khong bao gio luu mat khau ro.
/// </summary>
public interface IPasswordHasher
{
    /// <summary>Sinh hash cho mat khau ro.</summary>
    string Hash(string matKhau);

    /// <summary>
    /// Kiem tra mat khau co khop voi hash da luu hay khong.
    /// Tra <c>false</c> (khong nem loi) neu hash khong hop le.
    /// </summary>
    bool Verify(string matKhau, string hash);
}
