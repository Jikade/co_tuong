using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class v_danh_sach_ban_be
{
    public long ma_nguoi_dung { get; set; }

    public long ma_ban_be { get; set; }

    public DateTime ngay_tao { get; set; }
}
