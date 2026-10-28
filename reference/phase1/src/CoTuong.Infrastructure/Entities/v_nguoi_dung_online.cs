using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class v_nguoi_dung_online
{
    public long ma_nguoi_dung { get; set; }

    public string ten_dang_nhap { get; set; } = null!;

    public string ten_hien_thi { get; set; } = null!;

    public bool? dang_online { get; set; }
}
