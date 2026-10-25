using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class phong
{
    public long ma { get; set; }

    public string ma_so_phong { get; set; } = null!;

    public string token_moi { get; set; } = null!;

    public string ten { get; set; } = null!;

    public string che_do_hien_thi { get; set; } = null!;

    public string trang_thai { get; set; } = null!;

    public byte so_khan_gia_toi_da { get; set; }

    public long ma_nguoi_tao { get; set; }

    public DateTime ngay_tao { get; set; }

    public DateTime ngay_cap_nhat { get; set; }

    public DateTime? thoi_diem_dong { get; set; }

    public virtual ICollection<cam_vao_phong> cam_vao_phongs { get; set; } = new List<cam_vao_phong>();

    public virtual cuoc_goi_video? cuoc_goi_video { get; set; }

    public virtual ICollection<loi_moi_vao_phong> loi_moi_vao_phongs { get; set; } = new List<loi_moi_vao_phong>();

    public virtual nguoi_dung ma_nguoi_taoNavigation { get; set; } = null!;

    public virtual ICollection<su_kien_thanh_vien_phong> su_kien_thanh_vien_phongs { get; set; } = new List<su_kien_thanh_vien_phong>();

    public virtual thanh_vien_phong? thanh_vien_phong { get; set; }

    public virtual ICollection<thong_bao> thong_baos { get; set; } = new List<thong_bao>();

    public virtual ICollection<tin_nhan_phong> tin_nhan_phongs { get; set; } = new List<tin_nhan_phong>();

    public virtual tran_dau? tran_dau { get; set; }
}
