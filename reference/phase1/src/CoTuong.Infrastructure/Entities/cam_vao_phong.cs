using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class cam_vao_phong
{
    public long ma { get; set; }

    public long ma_phong { get; set; }

    public long ma_nguoi_dung { get; set; }

    public long ma_nguoi_cam { get; set; }

    public DateTime thoi_diem_bi_cam { get; set; }

    public virtual nguoi_dung ma_nguoi_camNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;

    public virtual phong ma_phongNavigation { get; set; } = null!;
}
