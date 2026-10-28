using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class ban_be
{
    public long ma_nguoi_dung_nho { get; set; }

    public long ma_nguoi_dung_lon { get; set; }

    public DateTime ngay_tao { get; set; }

    public long? ma_loi_moi_nguon { get; set; }

    public virtual loi_moi_ket_ban? ma_loi_moi_nguonNavigation { get; set; }

    public virtual nguoi_dung ma_nguoi_dung_lonNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_dung_nhoNavigation { get; set; } = null!;
}
