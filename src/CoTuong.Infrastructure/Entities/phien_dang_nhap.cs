using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class phien_dang_nhap
{
    public long ma { get; set; }

    public long ma_nguoi_dung { get; set; }

    public string refresh_token_bam { get; set; } = null!;

    public string? trinh_duyet { get; set; }

    public string? dia_chi_ip { get; set; }

    public DateTime ngay_tao { get; set; }

    public DateTime? lan_dung_cuoi { get; set; }

    public DateTime thoi_diem_het_han { get; set; }

    public DateTime? thoi_diem_thu_hoi { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;
}
