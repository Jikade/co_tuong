using System;
using System.Collections.Generic;

namespace CoTuong.Infrastructure.Entities;

public partial class nguoi_dung
{
    public long ma { get; set; }

    public string ten_dang_nhap { get; set; } = null!;

    public string ten_hien_thi { get; set; } = null!;

    public string email { get; set; } = null!;

    public string mat_khau_bam { get; set; } = null!;

    public string? anh_dai_dien { get; set; }

    public bool dang_hoat_dong { get; set; }

    public DateTime ngay_tao { get; set; }

    public DateTime ngay_cap_nhat { get; set; }

    public DateTime? thoi_diem_doi_mat_khau { get; set; }

    public DateTime? lan_dang_nhap_cuoi { get; set; }

    public virtual ICollection<ban_be> ban_bema_nguoi_dung_lonNavigations { get; set; } = new List<ban_be>();

    public virtual ICollection<ban_be> ban_bema_nguoi_dung_nhoNavigations { get; set; } = new List<ban_be>();

    public virtual cai_dat_nguoi_dung? cai_dat_nguoi_dung { get; set; }

    public virtual ICollection<cam_vao_phong> cam_vao_phongma_nguoi_camNavigations { get; set; } = new List<cam_vao_phong>();

    public virtual ICollection<cam_vao_phong> cam_vao_phongma_nguoi_dungNavigations { get; set; } = new List<cam_vao_phong>();

    public virtual ICollection<cuoc_goi_video> cuoc_goi_videoma_nguoi_goiNavigations { get; set; } = new List<cuoc_goi_video>();

    public virtual ICollection<cuoc_goi_video> cuoc_goi_videoma_nguoi_nhan_cuoc_goiNavigations { get; set; } = new List<cuoc_goi_video>();

    public virtual ICollection<de_nghi_hoa> de_nghi_hoas { get; set; } = new List<de_nghi_hoa>();

    public virtual ICollection<ket_noi_nguoi_dung> ket_noi_nguoi_dungs { get; set; } = new List<ket_noi_nguoi_dung>();

    public virtual ICollection<loi_moi_ket_ban> loi_moi_ket_banma_nguoi_guiNavigations { get; set; } = new List<loi_moi_ket_ban>();

    public virtual ICollection<loi_moi_ket_ban> loi_moi_ket_banma_nguoi_nhanNavigations { get; set; } = new List<loi_moi_ket_ban>();

    public virtual ICollection<loi_moi_vao_phong> loi_moi_vao_phongma_nguoi_duoc_moiNavigations { get; set; } = new List<loi_moi_vao_phong>();

    public virtual loi_moi_vao_phong? loi_moi_vao_phongma_nguoi_moiNavigation { get; set; }

    public virtual ICollection<mat_ket_noi_tran_dau> mat_ket_noi_tran_daus { get; set; } = new List<mat_ket_noi_tran_dau>();

    public virtual ICollection<nguoi_tham_gia_cuoc_goi> nguoi_tham_gia_cuoc_gois { get; set; } = new List<nguoi_tham_gia_cuoc_goi>();

    public virtual ICollection<nuoc_di_tran_dau> nuoc_di_tran_daus { get; set; } = new List<nuoc_di_tran_dau>();

    public virtual ICollection<phien_dang_nhap> phien_dang_nhaps { get; set; } = new List<phien_dang_nhap>();

    public virtual ICollection<phong> phongs { get; set; } = new List<phong>();

    public virtual ICollection<su_kien_thanh_vien_phong> su_kien_thanh_vien_phongma_nguoi_dungNavigations { get; set; } = new List<su_kien_thanh_vien_phong>();

    public virtual ICollection<su_kien_thanh_vien_phong> su_kien_thanh_vien_phongma_nguoi_thuc_hienNavigations { get; set; } = new List<su_kien_thanh_vien_phong>();

    public virtual ICollection<su_kien_tran_dau> su_kien_tran_daus { get; set; } = new List<su_kien_tran_dau>();

    public virtual ICollection<thanh_vien_phong> thanh_vien_phongs { get; set; } = new List<thanh_vien_phong>();

    public virtual ICollection<thong_bao> thong_baoma_nguoi_dungNavigations { get; set; } = new List<thong_bao>();

    public virtual ICollection<thong_bao> thong_baoma_nguoi_thuc_hienNavigations { get; set; } = new List<thong_bao>();

    public virtual ICollection<tin_nhan_phong> tin_nhan_phongma_chu_phongNavigations { get; set; } = new List<tin_nhan_phong>();

    public virtual ICollection<tin_nhan_phong> tin_nhan_phongma_doi_thuNavigations { get; set; } = new List<tin_nhan_phong>();

    public virtual ICollection<tin_nhan_phong> tin_nhan_phongma_nguoi_gui_tinNavigations { get; set; } = new List<tin_nhan_phong>();

    public virtual token_dat_lai_mat_khau? token_dat_lai_mat_khau { get; set; }

    public virtual ICollection<tran_dau> tran_dauma_nguoi_choi_denNavigations { get; set; } = new List<tran_dau>();

    public virtual ICollection<tran_dau> tran_dauma_nguoi_choi_doNavigations { get; set; } = new List<tran_dau>();

    public virtual ICollection<tran_dau> tran_dauma_nguoi_taoNavigations { get; set; } = new List<tran_dau>();

    public virtual ICollection<yeu_cau_dat_lai_mat_khau> yeu_cau_dat_lai_mat_khaus { get; set; } = new List<yeu_cau_dat_lai_mat_khau>();
}
