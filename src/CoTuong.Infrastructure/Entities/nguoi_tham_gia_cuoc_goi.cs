using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class nguoi_tham_gia_cuoc_goi
{
    public long ma_cuoc_goi { get; set; }

    public long ma_nguoi_dung { get; set; }

    public DateTime thoi_diem_vao { get; set; }

    public DateTime? thoi_diem_roi { get; set; }

    public bool chi_am_thanh { get; set; }

    public virtual cuoc_goi_video ma_cuoc_goiNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;
}
