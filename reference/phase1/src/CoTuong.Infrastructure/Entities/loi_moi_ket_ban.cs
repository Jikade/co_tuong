using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class loi_moi_ket_ban
{
    public long ma { get; set; }

    public long ma_nguoi_gui { get; set; }

    public long ma_nguoi_nhan { get; set; }

    public string trang_thai { get; set; } = null!;

    public DateTime ngay_tao { get; set; }

    public DateTime? thoi_diem_phan_hoi { get; set; }

    public long ma_nguoi_dung_nho { get; set; }

    public long ma_nguoi_dung_lon { get; set; }

    public virtual ICollection<ban_be> ban_bes { get; set; } = new List<ban_be>();

    public virtual nguoi_dung ma_nguoi_guiNavigation { get; set; } = null!;

    public virtual nguoi_dung ma_nguoi_nhanNavigation { get; set; } = null!;

    public virtual ICollection<thong_bao> thong_baos { get; set; } = new List<thong_bao>();
}
