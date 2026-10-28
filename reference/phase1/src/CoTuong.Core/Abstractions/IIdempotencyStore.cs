namespace CoTuong.Core.Abstractions;

/// <summary>
/// Luu khoa idempotency cho cac thao tac "bam nhieu lan".
///
/// <para>
/// README yeu cau: "Nhan nut Dang ky nhieu lan lien tiep khong duoc tao ra nhieu
/// tai khoan giong nhau", "Neu nguoi dung bam Tham gia nhieu lan lien tiep, he
/// thong chi xu ly mot yeu cau", "Neu nhan nut Bat dau nhieu lan lien tiep, he
/// thong chi tao mot Match duy nhat".</para>
///
/// <para>
/// Cach dung: <see cref="TryBeginAsync"/> ghi khoa vao bang
/// <c>dbo.yeu_cau_chong_lap</c>. Neu ghi thanh cong, thao tac chua tung chay
/// va caller duoc phep thuc hien. Neu khoa da ton tai, tra ve
/// <c>null</c> va caller phai tra lai ket qua da luu (khong thuc hien lai).</para>
/// </summary>
public interface IIdempotencyStore
{
    /// <summary>
    /// Thu ghi khoa idempotency cho thao tac.
    /// </summary>
    /// <param name="maNguoiDung">Nguoi thuc hien.</param>
    /// <param name="loaiYeuCau">Loai thao tac (xem <c>LoaiYeuCauChongLap</c>).</param>
    /// <param name="khoa">Khoa do client sinh.</param>
    /// <param name="cancellationToken">Token huy.</param>
    /// <returns>
    /// <c>true</c> neu day la lan dau (caller duoc thuc hien thao tac).
    /// <c>false</c> neu thao tac da duoc xu ly truoc do (caller phai tra lai ket qua da luu).
    /// </returns>
    Task<bool> TryBeginAsync(long maNguoiDung, string loaiYeuCau, string khoa, CancellationToken cancellationToken = default);

    /// <summary>Luu ket qua de lan retry nhan lai cung ket qua do.</summary>
    Task SaveResultAsync(long maNguoiDung, string loaiYeuCau, string khoa, string ketQuaJson, CancellationToken cancellationToken = default);

    /// <summary>Doc ket qua da luu (neu co).</summary>
    Task<string?> GetResultAsync(long maNguoiDung, string loaiYeuCau, string khoa, CancellationToken cancellationToken = default);
}
