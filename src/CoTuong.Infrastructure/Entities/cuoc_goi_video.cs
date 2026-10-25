using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class cuoc_goi_video
{
    public long ma { get; set; }

    public long ma_phong { get; set; }

    public long ma_nguoi_goi { get; set; }

    public long ma_nguoi_nhan_cuoc_goi { get; set; }

    public string trang_thai { get; set; } = null!;

    public DateTime thoi_diem_yeu_cau { get; set; }

    public DateTime thoi_diem_het_han { get; set; }

    public DateTime? thoi_diem_tra_loi { get; set; }

    public DateTime? thoi_diem_ket_thuc { get; set; }

    public string? ly_do_ket_thuc { get; set; }

    public virtual nguoi_dung ma_nguoi_goiNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_nhan_cuoc_goiNavigation { get; set; } = null!;

    public virtual phong ma_phongNavigation { get; set; } = null!;

    public virtual ICollection<nguoi_tham_gia_cuoc_goi> nguoi_tham_gia_cuoc_gois { get; set; } = new List<nguoi_tham_gia_cuoc_goi>();
}
