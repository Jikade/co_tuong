using System;
using System.Collections.Generic;
using CoTuong.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Infrastructure.Persistence;

public partial class CoTuongDbContext : DbContext
{
    public CoTuongDbContext(DbContextOptions<CoTuongDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<ban_be> ban_bes { get; set; }

    public virtual DbSet<cai_dat_nguoi_dung> cai_dat_nguoi_dungs { get; set; }

    public virtual DbSet<cam_vao_phong> cam_vao_phongs { get; set; }

    public virtual DbSet<cuoc_goi_video> cuoc_goi_videos { get; set; }

    public virtual DbSet<de_nghi_hoa> de_nghi_hoas { get; set; }

    public virtual DbSet<giao_dien_ban_co> giao_dien_ban_cos { get; set; }

    public virtual DbSet<ket_noi_nguoi_dung> ket_noi_nguoi_dungs { get; set; }

    public virtual DbSet<loi_moi_ket_ban> loi_moi_ket_bans { get; set; }

    public virtual DbSet<loi_moi_vao_phong> loi_moi_vao_phongs { get; set; }

    public virtual DbSet<mat_ket_noi_tran_dau> mat_ket_noi_tran_daus { get; set; }

    public virtual DbSet<nguoi_dung> nguoi_dungs { get; set; }

    public virtual DbSet<nguoi_tham_gia_cuoc_goi> nguoi_tham_gia_cuoc_gois { get; set; }

    public virtual DbSet<nuoc_di_tran_dau> nuoc_di_tran_daus { get; set; }

    public virtual DbSet<phien_dang_nhap> phien_dang_nhaps { get; set; }

    public virtual DbSet<phong> phongs { get; set; }

    public virtual DbSet<quan_co_tran_dau> quan_co_tran_daus { get; set; }

    public virtual DbSet<su_kien_thanh_vien_phong> su_kien_thanh_vien_phongs { get; set; }

    public virtual DbSet<su_kien_tran_dau> su_kien_tran_daus { get; set; }

    public virtual DbSet<thanh_vien_phong> thanh_vien_phongs { get; set; }

    public virtual DbSet<thong_bao> thong_baos { get; set; }

    public virtual DbSet<tin_nhan_phong> tin_nhan_phongs { get; set; }

    public virtual DbSet<token_dat_lai_mat_khau> token_dat_lai_mat_khaus { get; set; }

    public virtual DbSet<tran_dau> tran_daus { get; set; }

    public virtual DbSet<v_danh_sach_ban_be> v_danh_sach_ban_bes { get; set; }

    public virtual DbSet<v_lich_su_tran_dau> v_lich_su_tran_daus { get; set; }

    public virtual DbSet<v_nguoi_dung_online> v_nguoi_dung_onlines { get; set; }

    public virtual DbSet<v_phong_cong_khai> v_phong_cong_khais { get; set; }

    public virtual DbSet<v_thong_ke_nguoi_dung> v_thong_ke_nguoi_dungs { get; set; }

    public virtual DbSet<yeu_cau_dat_lai_mat_khau> yeu_cau_dat_lai_mat_khaus { get; set; }

    public virtual DbSet<yeu_cau_chong_lap> yeu_cau_chong_laps { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.UseCollation("Vietnamese_100_CI_AS");

        // Mapping cho bang mo rong Phase 1 (xem CoTuongDbContext.YeuCauChongLap.cs).
        ApplyYeuCauChongLap(modelBuilder);

        modelBuilder.Entity<ban_be>(entity =>
        {
            entity.HasKey(e => new { e.ma_nguoi_dung_nho, e.ma_nguoi_dung_lon });

            entity.ToTable("ban_be");

            entity.HasIndex(e => new { e.ma_nguoi_dung_lon, e.ma_nguoi_dung_nho }, "IX_ban_be_lon");

            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ban_be_tao");

            entity.HasOne(d => d.ma_loi_moi_nguonNavigation).WithMany(p => p.ban_bes)
                .HasForeignKey(d => d.ma_loi_moi_nguon)
                .HasConstraintName("FK_ban_be_yeu_cau");

            entity.HasOne(d => d.ma_nguoi_dung_lonNavigation).WithMany(p => p.ban_bema_nguoi_dung_lonNavigations)
                .HasForeignKey(d => d.ma_nguoi_dung_lon)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ban_be_lon");

            entity.HasOne(d => d.ma_nguoi_dung_nhoNavigation).WithMany(p => p.ban_bema_nguoi_dung_nhoNavigations)
                .HasForeignKey(d => d.ma_nguoi_dung_nho)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ban_be_nho");
        });

        modelBuilder.Entity<cai_dat_nguoi_dung>(entity =>
        {
            entity.HasKey(e => e.ma_nguoi_dung);

            entity.ToTable("cai_dat_nguoi_dung", tb => tb.HasTrigger("TR_cai_dat_nguoi_dung_ngay_cap_nhat"));

            entity.Property(e => e.ma_nguoi_dung).ValueGeneratedNever();
            entity.Property(e => e.bat_am_thanh).HasDefaultValue(true, "DF_nguoi_dung_cai_dat_am_thanh");
            entity.Property(e => e.ngay_cap_nhat)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_nguoi_dung_cai_dat_cap_nhat");

            entity.HasOne(d => d.ma_giao_dien_ban_coNavigation).WithMany(p => p.cai_dat_nguoi_dungs)
                .HasForeignKey(d => d.ma_giao_dien_ban_co)
                .HasConstraintName("FK_nguoi_dung_cai_dat_giao_dien");

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithOne(p => p.cai_dat_nguoi_dung)
                .HasForeignKey<cai_dat_nguoi_dung>(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_nguoi_dung_cai_dat_nguoi_dung");
        });

        modelBuilder.Entity<cam_vao_phong>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("cam_vao_phong");

            entity.HasIndex(e => new { e.ma_phong, e.ma_nguoi_dung }, "UX_cam_phong_phong_nguoi_dung").IsUnique();

            entity.Property(e => e.thoi_diem_bi_cam)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_cam_phong_luc");

            entity.HasOne(d => d.ma_nguoi_camNavigation).WithMany(p => p.cam_vao_phongma_nguoi_camNavigations)
                .HasForeignKey(d => d.ma_nguoi_cam)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_cam_phong_boi");

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.cam_vao_phongma_nguoi_dungNavigations)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_cam_phong_nguoi_dung");

            entity.HasOne(d => d.ma_phongNavigation).WithMany(p => p.cam_vao_phongs)
                .HasForeignKey(d => d.ma_phong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_cam_phong_phong");
        });

        modelBuilder.Entity<cuoc_goi_video>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("cuoc_goi_video");

            entity.HasIndex(e => new { e.ma_nguoi_nhan_cuoc_goi, e.trang_thai }, "IX_cuoc_goi_nguoi_nhan");

            entity.HasIndex(e => e.ma_phong, "UX_cuoc_goi_mot_dang_goi_moi_phong")
                .IsUnique()
                .HasFilter("([trang_thai] IN ('Ringing', 'Active'))");

            entity.Property(e => e.ly_do_ket_thuc)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.thoi_diem_het_han).HasPrecision(3);
            entity.Property(e => e.thoi_diem_ket_thuc).HasPrecision(3);
            entity.Property(e => e.thoi_diem_tra_loi).HasPrecision(3);
            entity.Property(e => e.thoi_diem_yeu_cau)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_cuoc_goi_yeu_cau");
            entity.Property(e => e.trang_thai)
                .HasMaxLength(9)
                .IsUnicode(false)
                .HasDefaultValue("Ringing", "DF_cuoc_goi_trang_thai");

            entity.HasOne(d => d.ma_nguoi_goiNavigation).WithMany(p => p.cuoc_goi_videoma_nguoi_goiNavigations)
                .HasForeignKey(d => d.ma_nguoi_goi)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_cuoc_goi_nguoi_goi");

            entity.HasOne(d => d.ma_nguoi_nhan_cuoc_goiNavigation).WithMany(p => p.cuoc_goi_videoma_nguoi_nhan_cuoc_goiNavigations)
                .HasForeignKey(d => d.ma_nguoi_nhan_cuoc_goi)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_cuoc_goi_nguoi_nhan");

            entity.HasOne(d => d.ma_phongNavigation).WithOne(p => p.cuoc_goi_video)
                .HasForeignKey<cuoc_goi_video>(d => d.ma_phong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_cuoc_goi_phong");
        });

        modelBuilder.Entity<de_nghi_hoa>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("de_nghi_hoa");

            entity.HasIndex(e => e.ma_tran_dau, "UX_de_nghi_hoa_mot_dang_cho")
                .IsUnique()
                .HasFilter("([trang_thai]='Pending')");

            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_de_nghi_hoa_tao");
            entity.Property(e => e.thoi_diem_phan_hoi).HasPrecision(3);
            entity.Property(e => e.trang_thai)
                .HasMaxLength(9)
                .IsUnicode(false)
                .HasDefaultValue("Pending", "DF_de_nghi_hoa_trang_thai");

            entity.HasOne(d => d.ma_nguoi_de_nghiNavigation).WithMany(p => p.de_nghi_hoas)
                .HasForeignKey(d => d.ma_nguoi_de_nghi)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_de_nghi_hoa_nguoi_dung");

            entity.HasOne(d => d.ma_tran_dauNavigation).WithOne(p => p.de_nghi_hoa)
                .HasForeignKey<de_nghi_hoa>(d => d.ma_tran_dau)
                .HasConstraintName("FK_de_nghi_hoa_tran");
        });

        modelBuilder.Entity<giao_dien_ban_co>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("giao_dien_ban_co");

            entity.HasIndex(e => e.ma_dinh_danh, "UX_ban_co_giao_dien_ma").IsUnique();

            entity.Property(e => e.anh_xem_truoc).HasMaxLength(500);
            entity.Property(e => e.dang_hoat_dong).HasDefaultValue(true, "DF_ban_co_giao_dien_hoat_dong");
            entity.Property(e => e.ma_dinh_danh)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.ten).HasMaxLength(60);
        });

        modelBuilder.Entity<ket_noi_nguoi_dung>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("ket_noi_nguoi_dung");

            entity.HasIndex(e => new { e.lan_thay_cuoi, e.ma_nguoi_dung }, "IX_ket_noi_nd_heartbeat").HasFilter("([thoi_diem_ngat_ket_noi] IS NULL)");

            entity.HasIndex(e => e.ma_nguoi_dung, "IX_ket_noi_nd_nguoi_dung_hoat_dong").HasFilter("([thoi_diem_ngat_ket_noi] IS NULL)");

            entity.HasIndex(e => e.ma_ket_noi, "UX_ket_noi_nd_ket_noi_ma").IsUnique();

            entity.Property(e => e.lan_thay_cuoi)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ket_noi_nd_thay");
            entity.Property(e => e.ma_ket_noi).HasMaxLength(100);
            entity.Property(e => e.thoi_diem_ket_noi)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_ket_noi_nd_ket_noi");
            entity.Property(e => e.thoi_diem_ngat_ket_noi).HasPrecision(3);

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.ket_noi_nguoi_dungs)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ket_noi_nd_nguoi_dung");
        });

        modelBuilder.Entity<loi_moi_ket_ban>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("loi_moi_ket_ban");

            entity.HasIndex(e => new { e.ma_nguoi_gui, e.trang_thai }, "IX_loi_moi_kb_nguoi_gui_dang_cho");

            entity.HasIndex(e => new { e.ma_nguoi_nhan, e.trang_thai }, "IX_loi_moi_kb_nguoi_nhan_dang_cho");

            entity.HasIndex(e => new { e.ma_nguoi_dung_nho, e.ma_nguoi_dung_lon }, "UX_loi_moi_kb_mot_dang_cho_moi_cap")
                .IsUnique()
                .HasFilter("([trang_thai]='Pending')");

            entity.Property(e => e.ma_nguoi_dung_lon).HasComputedColumnSql("(case when [ma_nguoi_gui]<[ma_nguoi_nhan] then [ma_nguoi_nhan] else [ma_nguoi_gui] end)", true);
            entity.Property(e => e.ma_nguoi_dung_nho).HasComputedColumnSql("(case when [ma_nguoi_gui]<[ma_nguoi_nhan] then [ma_nguoi_gui] else [ma_nguoi_nhan] end)", true);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_loi_moi_kb_tao");
            entity.Property(e => e.thoi_diem_phan_hoi).HasPrecision(3);
            entity.Property(e => e.trang_thai)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("Pending", "DF_loi_moi_kb_trang_thai");

            entity.HasOne(d => d.ma_nguoi_guiNavigation).WithMany(p => p.loi_moi_ket_banma_nguoi_guiNavigations)
                .HasForeignKey(d => d.ma_nguoi_gui)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_loi_moi_kb_nguoi_gui");

            entity.HasOne(d => d.ma_nguoi_nhanNavigation).WithMany(p => p.loi_moi_ket_banma_nguoi_nhanNavigations)
                .HasForeignKey(d => d.ma_nguoi_nhan)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_loi_moi_kb_nguoi_nhan");
        });

        modelBuilder.Entity<loi_moi_vao_phong>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("loi_moi_vao_phong");

            entity.HasIndex(e => new { e.ma_nguoi_duoc_moi, e.trang_thai, e.thoi_diem_het_han }, "IX_loi_moi_phong_nguoi_duoc_moi_dang_cho");

            entity.HasIndex(e => new { e.ma_phong, e.trang_thai }, "IX_loi_moi_phong_phong");

            entity.HasIndex(e => e.ma_nguoi_moi, "UX_loi_moi_phong_mot_dang_cho_moi_nguoi_moi")
                .IsUnique()
                .HasFilter("([trang_thai]='Pending')");

            entity.Property(e => e.thoi_diem_gui)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_loi_moi_phong_gui");
            entity.Property(e => e.thoi_diem_het_han).HasPrecision(3);
            entity.Property(e => e.thoi_diem_phan_hoi).HasPrecision(3);
            entity.Property(e => e.trang_thai)
                .HasMaxLength(11)
                .IsUnicode(false)
                .HasDefaultValue("Pending", "DF_loi_moi_phong_trang_thai");

            entity.HasOne(d => d.ma_nguoi_duoc_moiNavigation).WithMany(p => p.loi_moi_vao_phongma_nguoi_duoc_moiNavigations)
                .HasForeignKey(d => d.ma_nguoi_duoc_moi)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_loi_moi_phong_nguoi_duoc_moi");

            entity.HasOne(d => d.ma_nguoi_moiNavigation).WithMany(p => p.loi_moi_vao_phongma_nguoi_moiNavigations)
                .HasForeignKey(d => d.ma_nguoi_moi)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_loi_moi_phong_nguoi_moi");

            entity.HasOne(d => d.ma_phongNavigation).WithMany(p => p.loi_moi_vao_phongs)
                .HasForeignKey(d => d.ma_phong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_loi_moi_phong_phong");
        });

        modelBuilder.Entity<mat_ket_noi_tran_dau>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("mat_ket_noi_tran_dau");

            entity.HasIndex(e => e.han_ket_noi_lai, "IX_mat_kn_han").HasFilter("([trang_thai]='Waiting')");

            entity.HasIndex(e => new { e.ma_tran_dau, e.ma_nguoi_dung }, "UX_mat_kn_mot_dang_cho")
                .IsUnique()
                .HasFilter("([trang_thai]='Waiting')");

            entity.Property(e => e.han_ket_noi_lai).HasPrecision(3);
            entity.Property(e => e.thoi_diem_ket_noi_lai).HasPrecision(3);
            entity.Property(e => e.thoi_diem_ngat_ket_noi)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_mat_kn_ngat_kn");
            entity.Property(e => e.trang_thai)
                .HasMaxLength(11)
                .IsUnicode(false)
                .HasDefaultValue("Waiting", "DF_mat_kn_trang_thai");

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.mat_ket_noi_tran_daus)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_mat_kn_nguoi_dung");

            entity.HasOne(d => d.ma_tran_dauNavigation).WithMany(p => p.mat_ket_noi_tran_daus)
                .HasForeignKey(d => d.ma_tran_dau)
                .HasConstraintName("FK_mat_kn_tran");
        });

        modelBuilder.Entity<nguoi_dung>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("nguoi_dung", tb => tb.HasTrigger("TR_nguoi_dung_ngay_cap_nhat"));

            entity.HasIndex(e => e.ten_hien_thi, "IX_nguoi_dung_hien_thi_ten");

            entity.HasIndex(e => e.email, "UX_nguoi_dung_email").IsUnique();

            entity.HasIndex(e => e.ten_dang_nhap, "UX_nguoi_dung_ten_dang_nhap").IsUnique();

            entity.Property(e => e.anh_dai_dien).HasMaxLength(500);
            entity.Property(e => e.dang_hoat_dong).HasDefaultValue(true, "DF_nguoi_dung_la_hoat_dong");
            entity.Property(e => e.email).HasMaxLength(254);
            entity.Property(e => e.lan_dang_nhap_cuoi).HasPrecision(3);
            entity.Property(e => e.mat_khau_bam).HasMaxLength(255);
            entity.Property(e => e.ngay_cap_nhat)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_nguoi_dung_cap_nhat_luc");
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_nguoi_dung_tao_luc");
            entity.Property(e => e.ten_dang_nhap).HasMaxLength(50);
            entity.Property(e => e.ten_hien_thi).HasMaxLength(50);
            entity.Property(e => e.thoi_diem_doi_mat_khau).HasPrecision(3);
        });

        modelBuilder.Entity<nguoi_tham_gia_cuoc_goi>(entity =>
        {
            entity.HasKey(e => new { e.ma_cuoc_goi, e.ma_nguoi_dung });

            entity.ToTable("nguoi_tham_gia_cuoc_goi");

            entity.Property(e => e.thoi_diem_roi).HasPrecision(3);
            entity.Property(e => e.thoi_diem_vao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_tg_cuoc_goi_vao");

            entity.HasOne(d => d.ma_cuoc_goiNavigation).WithMany(p => p.nguoi_tham_gia_cuoc_gois)
                .HasForeignKey(d => d.ma_cuoc_goi)
                .HasConstraintName("FK_tg_cuoc_goi_goi");

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.nguoi_tham_gia_cuoc_gois)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tg_cuoc_goi_nguoi_dung");
        });

        modelBuilder.Entity<nuoc_di_tran_dau>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("nuoc_di_tran_dau");

            entity.HasIndex(e => new { e.ma_tran_dau, e.ma_nuoc_di_client }, "UX_nuoc_di_client_nuoc_di")
                .IsUnique()
                .HasFilter("([ma_nuoc_di_client] IS NOT NULL)");

            entity.HasIndex(e => new { e.ma_tran_dau, e.so_thu_tu_nuoc_di }, "UX_nuoc_di_tran_nuoc_di").IsUnique();

            entity.Property(e => e.ben)
                .HasMaxLength(5)
                .IsUnicode(false);
            entity.Property(e => e.ky_hieu).HasMaxLength(20);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_nuoc_di_tao");

            entity.HasOne(d => d.ma_nguoi_diNavigation).WithMany(p => p.nuoc_di_tran_daus)
                .HasForeignKey(d => d.ma_nguoi_di)
                .HasConstraintName("FK_nuoc_di_nguoi_di");

            entity.HasOne(d => d.ma_tran_dauNavigation).WithMany(p => p.nuoc_di_tran_daus)
                .HasForeignKey(d => d.ma_tran_dau)
                .HasConstraintName("FK_nuoc_di_tran");

            entity.HasOne(d => d.quan_co_tran_dau).WithMany(p => p.nuoc_di_tran_dauquan_co_tran_daus)
                .HasForeignKey(d => new { d.ma_tran_dau, d.so_quan })
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_nuoc_di_quan");

            entity.HasOne(d => d.quan_co_tran_dauNavigation).WithMany(p => p.nuoc_di_tran_dauquan_co_tran_dauNavigations)
                .HasForeignKey(d => new { d.ma_tran_dau, d.so_quan_bi_an })
                .HasConstraintName("FK_nuoc_di_bi_an");
        });

        modelBuilder.Entity<phien_dang_nhap>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("phien_dang_nhap");

            entity.HasIndex(e => new { e.ma_nguoi_dung, e.thoi_diem_thu_hoi, e.thoi_diem_het_han }, "IX_nguoi_dung_phien_nguoi_dung");

            entity.HasIndex(e => e.refresh_token_bam, "UX_nguoi_dung_phien_token").IsUnique();

            entity.Property(e => e.dia_chi_ip)
                .HasMaxLength(45)
                .IsUnicode(false);
            entity.Property(e => e.lan_dung_cuoi).HasPrecision(3);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_nguoi_dung_phien_tao");
            entity.Property(e => e.refresh_token_bam).HasMaxLength(128);
            entity.Property(e => e.thoi_diem_het_han).HasPrecision(3);
            entity.Property(e => e.thoi_diem_thu_hoi).HasPrecision(3);
            entity.Property(e => e.trinh_duyet).HasMaxLength(500);

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.phien_dang_nhaps)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_nguoi_dung_phien_nguoi_dung");
        });

        modelBuilder.Entity<phong>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("phong", tb => tb.HasTrigger("TR_phong_ngay_cap_nhat"));

            entity.HasIndex(e => new { e.che_do_hien_thi, e.trang_thai, e.ngay_tao }, "IX_phong_cong_khai_danh_sach").IsDescending(false, false, true);

            entity.HasIndex(e => e.ma_so_phong, "UX_phong_ma_hoat_dong")
                .IsUnique()
                .HasFilter("([trang_thai]<>'Closed')");

            entity.HasIndex(e => e.token_moi, "UX_phong_moi_token").IsUnique();

            entity.Property(e => e.che_do_hien_thi)
                .HasMaxLength(7)
                .IsUnicode(false);
            entity.Property(e => e.ma_so_phong)
                .HasMaxLength(6)
                .IsUnicode(false)
                .IsFixedLength();
            entity.Property(e => e.ngay_cap_nhat)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_phong_cap_nhat");
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_phong_tao");
            entity.Property(e => e.so_khan_gia_toi_da).HasDefaultValue((byte)10, "DF_phong_khan_gia_toi_da");
            entity.Property(e => e.ten).HasMaxLength(100);
            entity.Property(e => e.thoi_diem_dong).HasPrecision(3);
            entity.Property(e => e.token_moi)
                .HasMaxLength(32)
                .IsUnicode(false)
                .IsFixedLength();
            entity.Property(e => e.trang_thai)
                .HasMaxLength(16)
                .IsUnicode(false)
                .HasDefaultValue("WaitingOpponent", "DF_phong_trang_thai");

            entity.HasOne(d => d.ma_nguoi_taoNavigation).WithMany(p => p.phongs)
                .HasForeignKey(d => d.ma_nguoi_tao)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_phong_nguoi_tao");
        });

        modelBuilder.Entity<quan_co_tran_dau>(entity =>
        {
            entity.HasKey(e => new { e.ma_tran_dau, e.so_quan });

            entity.ToTable("quan_co_tran_dau");

            entity.HasIndex(e => new { e.ma_tran_dau, e.x_hien_tai, e.y_hien_tai }, "UX_quan_co_o")
                .IsUnique()
                .HasFilter("([da_bi_an]=(0))");

            entity.HasIndex(e => new { e.ma_tran_dau, e.x_ban_dau, e.y_ban_dau }, "UX_quan_co_vi_tri_ban_dau").IsUnique();

            entity.Property(e => e.ben)
                .HasMaxLength(5)
                .IsUnicode(false);
            entity.Property(e => e.loai_quan)
                .HasMaxLength(8)
                .IsUnicode(false);

            entity.HasOne(d => d.ma_tran_dauNavigation).WithMany(p => p.quan_co_tran_daus)
                .HasForeignKey(d => d.ma_tran_dau)
                .HasConstraintName("FK_quan_co_tran");
        });

        modelBuilder.Entity<su_kien_thanh_vien_phong>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("su_kien_thanh_vien_phong");

            entity.HasIndex(e => new { e.ma_phong, e.ngay_tao }, "IX_sk_tv_phong_phong_thoi_gian");

            entity.Property(e => e.loai_su_kien)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_sk_tv_phong_tao");
            entity.Property(e => e.vai_tro_cu)
                .HasMaxLength(9)
                .IsUnicode(false);
            entity.Property(e => e.vai_tro_moi)
                .HasMaxLength(9)
                .IsUnicode(false);

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.su_kien_thanh_vien_phongma_nguoi_dungNavigations)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_sk_tv_phong_nguoi_dung");

            entity.HasOne(d => d.ma_nguoi_thuc_hienNavigation).WithMany(p => p.su_kien_thanh_vien_phongma_nguoi_thuc_hienNavigations)
                .HasForeignKey(d => d.ma_nguoi_thuc_hien)
                .HasConstraintName("FK_sk_tv_phong_nguoi_thuc_hien");

            entity.HasOne(d => d.ma_phongNavigation).WithMany(p => p.su_kien_thanh_vien_phongs)
                .HasForeignKey(d => d.ma_phong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_sk_tv_phong_phong");
        });

        modelBuilder.Entity<su_kien_tran_dau>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("su_kien_tran_dau");

            entity.HasIndex(e => new { e.ma_tran_dau, e.ngay_tao }, "IX_sk_tran_tran_thoi_gian");

            entity.Property(e => e.loai_su_kien)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_sk_tran_tao");

            entity.HasOne(d => d.ma_nguoi_thuc_hienNavigation).WithMany(p => p.su_kien_tran_daus)
                .HasForeignKey(d => d.ma_nguoi_thuc_hien)
                .HasConstraintName("FK_sk_tran_nguoi_thuc_hien");

            entity.HasOne(d => d.ma_tran_dauNavigation).WithMany(p => p.su_kien_tran_daus)
                .HasForeignKey(d => d.ma_tran_dau)
                .HasConstraintName("FK_sk_tran_tran");
        });

        modelBuilder.Entity<thanh_vien_phong>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("thanh_vien_phong");

            entity.HasIndex(e => e.ma_nguoi_dung, "IX_tv_phong_nguoi_dung_hoat_dong").HasFilter("([thoi_diem_roi] IS NULL)");

            entity.HasIndex(e => new { e.ma_phong, e.thoi_diem_vao }, "IX_tv_phong_phong_khan_gia").HasFilter("([vai_tro]='Spectator' AND [thoi_diem_roi] IS NULL)");

            entity.HasIndex(e => new { e.ma_phong, e.ma_nguoi_dung }, "UX_tv_phong_hoat_dong_thanh_vien")
                .IsUnique()
                .HasFilter("([thoi_diem_roi] IS NULL)");

            entity.HasIndex(e => e.ma_phong, "UX_tv_phong_mot_chu_phong")
                .IsUnique()
                .HasFilter("([vai_tro]='Host' AND [thoi_diem_roi] IS NULL)");

            entity.HasIndex(e => e.ma_phong, "UX_tv_phong_mot_doi_thu")
                .IsUnique()
                .HasFilter("([vai_tro]='Opponent' AND [thoi_diem_roi] IS NULL)");

            entity.Property(e => e.ly_do_roi)
                .HasMaxLength(12)
                .IsUnicode(false);
            entity.Property(e => e.nguon_tham_gia)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.thoi_diem_nhan_vai_tro)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_tv_phong_vai_tro_luc");
            entity.Property(e => e.thoi_diem_roi).HasPrecision(3);
            entity.Property(e => e.thoi_diem_san_sang).HasPrecision(3);
            entity.Property(e => e.thoi_diem_vao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_tv_phong_vao");
            entity.Property(e => e.vai_tro)
                .HasMaxLength(9)
                .IsUnicode(false);

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.thanh_vien_phongs)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tv_phong_nguoi_dung");

            entity.HasOne(d => d.ma_phongNavigation).WithMany(p => p.thanh_vien_phongs)
                .HasForeignKey(d => d.ma_phong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tv_phong_phong");
        });

        modelBuilder.Entity<thong_bao>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("thong_bao");

            entity.HasIndex(e => new { e.ma_nguoi_dung, e.da_doc, e.ngay_tao }, "IX_thong_bao_nguoi_dung_chua_doc").IsDescending(false, false, true);

            entity.Property(e => e.loai)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_thong_bao_tao");
            entity.Property(e => e.thoi_diem_doc).HasPrecision(3);

            entity.HasOne(d => d.ma_loi_moi_ket_banNavigation).WithMany(p => p.thong_baos)
                .HasForeignKey(d => d.ma_loi_moi_ket_ban)
                .HasConstraintName("FK_thong_bao_loi_moi_kb");

            entity.HasOne(d => d.ma_loi_moi_vao_phongNavigation).WithMany(p => p.thong_baos)
                .HasForeignKey(d => d.ma_loi_moi_vao_phong)
                .HasConstraintName("FK_thong_bao_loi_moi_phong");

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.thong_baoma_nguoi_dungNavigations)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_thong_bao_nguoi_dung");

            entity.HasOne(d => d.ma_nguoi_thuc_hienNavigation).WithMany(p => p.thong_baoma_nguoi_thuc_hienNavigations)
                .HasForeignKey(d => d.ma_nguoi_thuc_hien)
                .HasConstraintName("FK_thong_bao_nguoi_thuc_hien");

            entity.HasOne(d => d.ma_phongNavigation).WithMany(p => p.thong_baos)
                .HasForeignKey(d => d.ma_phong)
                .HasConstraintName("FK_thong_bao_phong");
        });

        modelBuilder.Entity<tin_nhan_phong>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("tin_nhan_phong");

            entity.HasIndex(e => new { e.ma_phong, e.thoi_diem_gui }, "IX_tin_nhan_phong_thoi_gian");

            entity.Property(e => e.noi_dung).HasMaxLength(1000);
            entity.Property(e => e.thoi_diem_gui)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_tin_nhan_gui");

            entity.HasOne(d => d.ma_chu_phongNavigation).WithMany(p => p.tin_nhan_phongma_chu_phongNavigations)
                .HasForeignKey(d => d.ma_chu_phong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tin_nhan_chu_phong");

            entity.HasOne(d => d.ma_doi_thuNavigation).WithMany(p => p.tin_nhan_phongma_doi_thuNavigations)
                .HasForeignKey(d => d.ma_doi_thu)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tin_nhan_doi_thu");

            entity.HasOne(d => d.ma_nguoi_gui_tinNavigation).WithMany(p => p.tin_nhan_phongma_nguoi_gui_tinNavigations)
                .HasForeignKey(d => d.ma_nguoi_gui_tin)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tin_nhan_nguoi_gui");

            entity.HasOne(d => d.ma_phongNavigation).WithMany(p => p.tin_nhan_phongs)
                .HasForeignKey(d => d.ma_phong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tin_nhan_phong");
        });

        modelBuilder.Entity<token_dat_lai_mat_khau>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("token_dat_lai_mat_khau");

            entity.HasIndex(e => e.ma_nguoi_dung, "UX_token_dat_lai_mot_hoat_dong_moi_nguoi_dung")
                .IsUnique()
                .HasFilter("([trang_thai]='Active')");

            entity.HasIndex(e => e.token_bam, "UX_token_dat_lai_token_bam").IsUnique();

            entity.Property(e => e.ip_yeu_cau)
                .HasMaxLength(45)
                .IsUnicode(false);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_token_dat_lai_tao");
            entity.Property(e => e.thoi_diem_het_han).HasPrecision(3);
            entity.Property(e => e.thoi_diem_su_dung).HasPrecision(3);
            entity.Property(e => e.thoi_diem_thu_hoi).HasPrecision(3);
            entity.Property(e => e.token_bam).HasMaxLength(128);
            entity.Property(e => e.trang_thai)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("Active", "DF_token_dat_lai_trang_thai");

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.token_dat_lai_mat_khaus)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_token_dat_lai_nguoi_dung");
        });

        modelBuilder.Entity<tran_dau>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("tran_dau");

            entity.HasIndex(e => new { e.ma_nguoi_choi_den, e.trang_thai, e.thoi_diem_ket_thuc }, "IX_tran_dau_den").IsDescending(false, false, true);

            entity.HasIndex(e => new { e.ma_nguoi_choi_do, e.trang_thai, e.thoi_diem_ket_thuc }, "IX_tran_dau_do").IsDescending(false, false, true);

            entity.HasIndex(e => e.trang_thai, "IX_tran_dau_hoat_dong").HasFilter("([trang_thai]<>'Finished')");

            entity.HasIndex(e => new { e.ma_phong, e.ngay_tao }, "IX_tran_dau_phong").IsDescending(false, true);

            entity.HasIndex(e => e.ma_phong, "UX_tran_dau_mot_active_room")
                .IsUnique()
                .HasFilter("([ma_phong] IS NOT NULL AND [trang_thai]<>'Finished')");

            entity.Property(e => e.ben_bi_chieu)
                .HasMaxLength(5)
                .IsUnicode(false);
            entity.Property(e => e.ben_cua_may)
                .HasMaxLength(5)
                .IsUnicode(false);
            entity.Property(e => e.ben_den_luot)
                .HasMaxLength(5)
                .IsUnicode(false)
                .HasDefaultValue("Red", "DF_tran_dau_den_luot");
            entity.Property(e => e.gioi_han_luot_giay).HasDefaultValue((short)60, "DF_tran_dau_gioi_han");
            entity.Property(e => e.ket_qua)
                .HasMaxLength(8)
                .IsUnicode(false);
            entity.Property(e => e.loai_tran)
                .HasMaxLength(3)
                .IsUnicode(false);
            entity.Property(e => e.ly_do_ket_thuc)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.ma_nguoi_thang).HasComputedColumnSql("(case [ket_qua] when 'RedWin' then [ma_nguoi_choi_do] when 'BlackWin' then [ma_nguoi_choi_den]  end)", true);
            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_tran_dau_tao");
            entity.Property(e => e.thoi_diem_bat_dau).HasPrecision(3);
            entity.Property(e => e.thoi_diem_bat_dau_dem_nguoc).HasPrecision(3);
            entity.Property(e => e.thoi_diem_bat_dau_luot).HasPrecision(3);
            entity.Property(e => e.thoi_diem_ket_thuc).HasPrecision(3);
            entity.Property(e => e.thoi_diem_nuoc_di_cuoi).HasPrecision(3);
            entity.Property(e => e.trang_thai)
                .HasMaxLength(15)
                .IsUnicode(false)
                .HasDefaultValue("Countdown", "DF_tran_dau_trang_thai");

            entity.HasOne(d => d.ma_nguoi_choi_denNavigation).WithMany(p => p.tran_dauma_nguoi_choi_denNavigations)
                .HasForeignKey(d => d.ma_nguoi_choi_den)
                .HasConstraintName("FK_tran_dau_den");

            entity.HasOne(d => d.ma_nguoi_choi_doNavigation).WithMany(p => p.tran_dauma_nguoi_choi_doNavigations)
                .HasForeignKey(d => d.ma_nguoi_choi_do)
                .HasConstraintName("FK_tran_dau_do");

            entity.HasOne(d => d.ma_nguoi_taoNavigation).WithMany(p => p.tran_dauma_nguoi_taoNavigations)
                .HasForeignKey(d => d.ma_nguoi_tao)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_tran_dau_nguoi_tao");

            entity.HasOne(d => d.ma_phongNavigation).WithMany(p => p.tran_daus)
                .HasForeignKey(d => d.ma_phong)
                .HasConstraintName("FK_tran_dau_phong");
        });

        modelBuilder.Entity<v_danh_sach_ban_be>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("v_danh_sach_ban_be");

            entity.Property(e => e.ngay_tao).HasPrecision(3);
        });

        modelBuilder.Entity<v_lich_su_tran_dau>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("v_lich_su_tran_dau");

            entity.Property(e => e.ben)
                .HasMaxLength(5)
                .IsUnicode(false);
            entity.Property(e => e.ket_qua)
                .HasMaxLength(8)
                .IsUnicode(false);
            entity.Property(e => e.ket_qua_ca_nhan)
                .HasMaxLength(6)
                .IsUnicode(false);
            entity.Property(e => e.loai_tran)
                .HasMaxLength(3)
                .IsUnicode(false);
            entity.Property(e => e.ly_do_ket_thuc)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.thoi_diem_bat_dau).HasPrecision(3);
            entity.Property(e => e.thoi_diem_ket_thuc).HasPrecision(3);
        });

        modelBuilder.Entity<v_nguoi_dung_online>(entity =>
        {
            if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
                entity.HasKey(e => e.ma_nguoi_dung);
            else
                entity.HasNoKey().ToView("v_nguoi_dung_online");

            entity.Property(e => e.ma_nguoi_dung).ValueGeneratedOnAdd();
            entity.Property(e => e.ten_dang_nhap).HasMaxLength(50);
            entity.Property(e => e.ten_hien_thi).HasMaxLength(50);
        });

        modelBuilder.Entity<v_phong_cong_khai>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("v_phong_cong_khai");

            entity.Property(e => e.ma_so_phong)
                .HasMaxLength(6)
                .IsUnicode(false)
                .IsFixedLength();
            entity.Property(e => e.ngay_tao).HasPrecision(3);
            entity.Property(e => e.ten_hien_thi_chu_phong).HasMaxLength(50);
            entity.Property(e => e.ten_phong).HasMaxLength(100);
            entity.Property(e => e.trang_thai)
                .HasMaxLength(16)
                .IsUnicode(false);
        });

        modelBuilder.Entity<v_thong_ke_nguoi_dung>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("v_thong_ke_nguoi_dung");
        });

        modelBuilder.Entity<yeu_cau_dat_lai_mat_khau>(entity =>
        {
            entity.HasKey(e => e.ma);

            entity.ToTable("yeu_cau_dat_lai_mat_khau");

            entity.HasIndex(e => new { e.email, e.thoi_diem_yeu_cau }, "IX_yc_dat_lai_email_thoi_gian");

            entity.HasIndex(e => new { e.ip_yeu_cau, e.thoi_diem_yeu_cau }, "IX_yc_dat_lai_ip_thoi_gian");

            entity.Property(e => e.email).HasMaxLength(254);
            entity.Property(e => e.ip_yeu_cau)
                .HasMaxLength(45)
                .IsUnicode(false);
            entity.Property(e => e.thoi_diem_yeu_cau)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_yc_dat_lai_yeu_cau");

            entity.HasOne(d => d.ma_nguoi_dungNavigation).WithMany(p => p.yeu_cau_dat_lai_mat_khaus)
                .HasForeignKey(d => d.ma_nguoi_dung)
                .HasConstraintName("FK_yc_dat_lai_nguoi_dung");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
