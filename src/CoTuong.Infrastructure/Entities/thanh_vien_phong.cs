using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class thanh_vien_phong
{
    public long ma { get; set; }

    public long ma_phong { get; set; }

    public long ma_nguoi_dung { get; set; }

    public string vai_tro { get; set; } = null!;

    public bool san_sang { get; set; }

    public DateTime? thoi_diem_san_sang { get; set; }

    public DateTime thoi_diem_vao { get; set; }

    public DateTime thoi_diem_nhan_vai_tro { get; set; }

    public string? nguon_tham_gia { get; set; }

    public DateTime? thoi_diem_roi { get; set; }

    public string? ly_do_roi { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;

    public virtual phong ma_phongNavigation { get; set; } = null!;
}
