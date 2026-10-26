using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class giao_dien_ban_co
{
    public int ma { get; set; }

    public string ma_dinh_danh { get; set; } = null!;

    public string ten { get; set; } = null!;

    public string? anh_xem_truoc { get; set; }

    public bool dang_hoat_dong { get; set; }

    public int thu_tu_sap_xep { get; set; }

    public virtual ICollection<cai_dat_nguoi_dung> cai_dat_nguoi_dungs { get; set; } = new List<cai_dat_nguoi_dung>();
}
