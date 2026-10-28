using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class ket_noi_nguoi_dung
{
    public long ma { get; set; }

    public long ma_nguoi_dung { get; set; }

    public string ma_ket_noi { get; set; } = null!;

    public DateTime thoi_diem_ket_noi { get; set; }

    public DateTime lan_thay_cuoi { get; set; }

    public DateTime? thoi_diem_ngat_ket_noi { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;
}
