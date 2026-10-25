using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class tin_nhan_phong
{
    public long ma { get; set; }

    public long ma_phong { get; set; }

    public long ma_nguoi_gui_tin { get; set; }

    public long ma_chu_phong { get; set; }

    public long ma_doi_thu { get; set; }

    public string noi_dung { get; set; } = null!;

    public DateTime thoi_diem_gui { get; set; }

    public virtual nguoi_dung ma_chu_phongNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_doi_thuNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_gui_tinNavigation { get; set; } = null!;

    public virtual phong ma_phongNavigation { get; set; } = null!;
}
