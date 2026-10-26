using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class cai_dat_nguoi_dung
{
    public long ma_nguoi_dung { get; set; }

    public int? ma_giao_dien_ban_co { get; set; }

    public bool bat_am_thanh { get; set; }

    public DateTime ngay_cap_nhat { get; set; }

    public virtual giao_dien_ban_co? ma_giao_dien_ban_coNavigation { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;
}
