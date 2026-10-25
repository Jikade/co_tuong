using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class de_nghi_hoa
{
    public long ma { get; set; }

    public long ma_tran_dau { get; set; }

    public long ma_nguoi_de_nghi { get; set; }

    public string trang_thai { get; set; } = null!;

    public DateTime ngay_tao { get; set; }

    public DateTime? thoi_diem_phan_hoi { get; set; }

    public virtual nguoi_dung ma_nguoi_de_nghiNavigation { get; set; } = null!;

    public virtual tran_dau ma_tran_dauNavigation { get; set; } = null!;
}
