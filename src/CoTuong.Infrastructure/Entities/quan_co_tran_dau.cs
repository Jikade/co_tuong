using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class quan_co_tran_dau
{
    public long ma_tran_dau { get; set; }

    public byte so_quan { get; set; }

    public string ben { get; set; } = null!;

    public string loai_quan { get; set; } = null!;

    public byte x_ban_dau { get; set; }

    public byte y_ban_dau { get; set; }

    public byte? x_hien_tai { get; set; }

    public byte? y_hien_tai { get; set; }

    public bool da_bi_an { get; set; }

    public int? bi_an_o_nuoc_thu { get; set; }

    public virtual tran_dau ma_tran_dauNavigation { get; set; } = null!;

    public virtual ICollection<nuoc_di_tran_dau> nuoc_di_tran_dauquan_co_tran_dauNavigations { get; set; } = new List<nuoc_di_tran_dau>();

    public virtual ICollection<nuoc_di_tran_dau> nuoc_di_tran_dauquan_co_tran_daus { get; set; } = new List<nuoc_di_tran_dau>();
}
