using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class nuoc_di_tran_dau
{
    public long ma { get; set; }

    public long ma_tran_dau { get; set; }

    public int so_thu_tu_nuoc_di { get; set; }

    public string ben { get; set; } = null!;

    public long? ma_nguoi_di { get; set; }

    public byte so_quan { get; set; }

    public byte tu_x { get; set; }

    public byte tu_y { get; set; }

    public byte den_x { get; set; }

    public byte den_y { get; set; }

    public byte? so_quan_bi_an { get; set; }

    public bool gay_chieu { get; set; }

    public string? ky_hieu { get; set; }

    public int? thoi_gian_di_ms { get; set; }

    public Guid? ma_nuoc_di_client { get; set; }

    public DateTime ngay_tao { get; set; }

    public virtual nguoi_dung? ma_nguoi_diNavigation { get; set; }

    public virtual tran_dau ma_tran_dauNavigation { get; set; } = null!;

    public virtual quan_co_tran_dau quan_co_tran_dau { get; set; } = null!;

    public virtual quan_co_tran_dau? quan_co_tran_dauNavigation { get; set; }
}
