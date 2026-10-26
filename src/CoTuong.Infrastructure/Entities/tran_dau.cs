using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class tran_dau
{
    public long ma { get; set; }

    public string loai_tran { get; set; } = null!;

    public long? ma_phong { get; set; }

    public long ma_nguoi_tao { get; set; }

    public long? ma_nguoi_choi_do { get; set; }

    public long? ma_nguoi_choi_den { get; set; }

    public string? ben_cua_may { get; set; }

    public string trang_thai { get; set; } = null!;

    public string ben_den_luot { get; set; } = null!;

    public int so_nuoc_di { get; set; }

    public string? ben_bi_chieu { get; set; }

    public short gioi_han_luot_giay { get; set; }

    public DateTime? thoi_diem_bat_dau_luot { get; set; }

    public int? thoi_gian_con_lai_ms { get; set; }

    public int phien_ban_trang_thai { get; set; }

    public string? ket_qua { get; set; }

    public string? ly_do_ket_thuc { get; set; }

    public long? ma_nguoi_thang { get; set; }

    public DateTime ngay_tao { get; set; }

    public DateTime? thoi_diem_bat_dau_dem_nguoc { get; set; }

    public DateTime? thoi_diem_bat_dau { get; set; }

    public DateTime? thoi_diem_nuoc_di_cuoi { get; set; }

    public DateTime? thoi_diem_ket_thuc { get; set; }

    public virtual de_nghi_hoa? de_nghi_hoa { get; set; }

    public virtual nguoi_dung? ma_nguoi_choi_denNavigation { get; set; }

    public virtual nguoi_dung? ma_nguoi_choi_doNavigation { get; set; }

    public virtual nguoi_dung ma_nguoi_taoNavigation { get; set; } = null!;

    public virtual phong? ma_phongNavigation { get; set; }

    public virtual ICollection<mat_ket_noi_tran_dau> mat_ket_noi_tran_daus { get; set; } = new List<mat_ket_noi_tran_dau>();

    public virtual ICollection<nuoc_di_tran_dau> nuoc_di_tran_daus { get; set; } = new List<nuoc_di_tran_dau>();

    public virtual ICollection<quan_co_tran_dau> quan_co_tran_daus { get; set; } = new List<quan_co_tran_dau>();

    public virtual ICollection<su_kien_tran_dau> su_kien_tran_daus { get; set; } = new List<su_kien_tran_dau>();
}
