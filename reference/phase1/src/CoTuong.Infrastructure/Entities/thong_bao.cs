using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class thong_bao
{
    public long ma { get; set; }

    public long ma_nguoi_dung { get; set; }

    public string loai { get; set; } = null!;

    public long? ma_nguoi_thuc_hien { get; set; }

    public long? ma_loi_moi_ket_ban { get; set; }

    public long? ma_loi_moi_vao_phong { get; set; }

    public long? ma_phong { get; set; }

    public string? du_lieu_phu { get; set; }

    public bool da_doc { get; set; }

    public DateTime ngay_tao { get; set; }

    public DateTime? thoi_diem_doc { get; set; }

    public virtual loi_moi_ket_ban? ma_loi_moi_ket_banNavigation { get; set; }

    public virtual loi_moi_vao_phong? ma_loi_moi_vao_phongNavigation { get; set; }

    public virtual nguoi_dung ma_nguoi_dungNavigation { get; set; } = null!;

    public virtual nguoi_dung? ma_nguoi_thuc_hienNavigation { get; set; }

    public virtual phong? ma_phongNavigation { get; set; }
}
