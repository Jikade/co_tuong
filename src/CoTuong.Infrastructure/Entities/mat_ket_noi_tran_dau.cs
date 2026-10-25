using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class mat_ket_noi_tran_dau
{
    public long ma { get; set; }

    public long ma_tran_dau { get; set; }

    public long ma_nguoi_dung { get; set; }

    public DateTime thoi_diem_ngat_ket_noi { get; set; }

    public DateTime han_ket_noi_lai { get; set; }

    public DateTime? thoi_diem_ket_noi_lai { get; set; }

    public string trang_thai { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;

    public virtual tran_dau ma_tran_dauNavigation { get; set; } = null!;
}
