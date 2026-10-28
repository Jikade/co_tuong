using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class v_phong_cong_khai
{
    public long ma_phong { get; set; }

    public string ma_so_phong { get; set; } = null!;

    public string ten_phong { get; set; } = null!;

    public string trang_thai { get; set; } = null!;

    public long? ma_chu_phong { get; set; }

    public string? ten_hien_thi_chu_phong { get; set; }

    public int? so_khan_gia { get; set; }

    public byte so_khan_gia_toi_da { get; set; }

    public DateTime ngay_tao { get; set; }
}
