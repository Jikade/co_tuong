using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class yeu_cau_dat_lai_mat_khau
{
    public long ma { get; set; }

    public string email { get; set; } = null!;

    public long? ma_nguoi_dung { get; set; }

    public string? ip_yeu_cau { get; set; }

    public DateTime thoi_diem_yeu_cau { get; set; }

    public virtual nguoi_dung? ma_nguoi_dungNavigation { get; set; }
}
