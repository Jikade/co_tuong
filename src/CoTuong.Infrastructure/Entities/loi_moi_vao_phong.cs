using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class loi_moi_vao_phong
{
    public long ma { get; set; }

    public long ma_phong { get; set; }

    public long ma_nguoi_moi { get; set; }

    public long ma_nguoi_duoc_moi { get; set; }

    public string trang_thai { get; set; } = null!;

    public DateTime thoi_diem_gui { get; set; }

    public DateTime thoi_diem_het_han { get; set; }

    public DateTime? thoi_diem_phan_hoi { get; set; }

    public virtual nguoi_dung ma_nguoi_duoc_moiNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_moiNavigation { get; set; } = null!;

    public virtual phong ma_phongNavigation { get; set; } = null!;

    public virtual ICollection<thong_bao> thong_baos { get; set; } = new List<thong_bao>();
}
