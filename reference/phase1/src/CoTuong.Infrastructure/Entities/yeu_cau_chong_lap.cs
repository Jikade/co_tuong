using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

/// <summary>
/// Khoa idempotency cho cac thao tac "bam nhieu lan".
///
/// <para>
/// README (Phase 1) yeu cau: bam Dung ky / Tao Room / Bat dau nhieu lan lien tiep
/// chi duoc tao mot ban ghi. CHECK/UNIQUE constraint khong lo duoc hanh vi
/// nghiep vu, nen Backend sinh khoa (Guid) cho moi thao tac va ghi lai khoa do
/// vao bang nay. Lan gui lai cung khoa se tim thay ban ghi cu va tra ve
/// <see cref="ket_qua_bam"/> ma khong thuc hien thao tac hai lan.</para>
///
/// <para>Bang nay la mo rong duy nhat cua Phase 1 so voi schema goc.</para>
/// </summary>
public partial class yeu_cau_chong_lap
{
    public long ma { get; set; }

    public long ma_nguoi_dung { get; set; }

    /// <summary>Khoa idempotency do client sinh cho thao tac nay.</summary>
    public string khoa_idempotency { get; set; } = null!;

    /// <summary>Loai thao tac: Register | CreateRoom | StartMatch | ...</summary>
    public string loai_yeu_cau { get; set; } = null!;

    /// <summary>JSON ket qua tra ve lan dau, de retry tra lai dung ket qua do.</summary>
    public string? ket_qua_bam { get; set; }

    public DateTime ngay_tao { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;
}
