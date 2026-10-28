using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class su_kien_thanh_vien_phong
{
    public long ma { get; set; }

    public long ma_phong { get; set; }

    public long ma_nguoi_dung { get; set; }

    public long? ma_nguoi_thuc_hien { get; set; }

    public string loai_su_kien { get; set; } = null!;

    public string? vai_tro_cu { get; set; }

    public string? vai_tro_moi { get; set; }

    public DateTime ngay_tao { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;

    public virtual nguoi_dung? ma_nguoi_thuc_hienNavigation { get; set; }

    public virtual phong ma_phongNavigation { get; set; } = null!;
}
