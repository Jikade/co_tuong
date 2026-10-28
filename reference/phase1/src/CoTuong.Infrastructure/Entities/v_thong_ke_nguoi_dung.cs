using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class v_thong_ke_nguoi_dung
{
    public long ma_nguoi_dung { get; set; }

    public int? tong_so_tran { get; set; }

    public int? so_tran_thang { get; set; }

    public int? so_tran_thua { get; set; }

    public int? so_tran_hoa { get; set; }
}
