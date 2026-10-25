using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class su_kien_tran_dau
{
    public long ma { get; set; }

    public long ma_tran_dau { get; set; }

    public string loai_su_kien { get; set; } = null!;

    public long? ma_nguoi_thuc_hien { get; set; }

    public string? chi_tiet { get; set; }

    public DateTime ngay_tao { get; set; }

    public virtual nguoi_dung? ma_nguoi_thuc_hienNavigation { get; set; }

    public virtual tran_dau ma_tran_dauNavigation { get; set; } = null!;
}
