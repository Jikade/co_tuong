using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class token_dat_lai_mat_khau
{
    public long ma { get; set; }

    public long ma_nguoi_dung { get; set; }

    public string token_bam { get; set; } = null!;

    public string trang_thai { get; set; } = null!;

    public DateTime ngay_tao { get; set; }

    public DateTime thoi_diem_het_han { get; set; }

    public DateTime? thoi_diem_su_dung { get; set; }

    public DateTime? thoi_diem_thu_hoi { get; set; }

    public string? ip_yeu_cau { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;
}
