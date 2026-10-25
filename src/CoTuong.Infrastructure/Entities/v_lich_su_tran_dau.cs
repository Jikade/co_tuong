using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class v_lich_su_tran_dau
{
    public long? ma_nguoi_dung { get; set; }

    public long ma_tran_dau { get; set; }

    public string loai_tran { get; set; } = null!;

    public string? ben { get; set; }

    public long? ma_doi_thu { get; set; }

    public string? ket_qua { get; set; }

    public string? ly_do_ket_thuc { get; set; }

    public DateTime? thoi_diem_bat_dau { get; set; }

    public DateTime? thoi_diem_ket_thuc { get; set; }

    public int so_nuoc_di { get; set; }

    public int? thoi_luong_giay { get; set; }

    public string ket_qua_ca_nhan { get; set; } = null!;
}
