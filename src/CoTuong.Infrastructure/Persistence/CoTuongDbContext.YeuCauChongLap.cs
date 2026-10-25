using CoTuong.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace CoTuong.Infrastructure.Persistence;

/// <summary>
/// Mapping cho bang mo rong Phase 1 (<c>yeu_cau_chong_lap</c>).
///
/// <para>
/// Scaffold sinh code cho 24 bang goc; bang mo rong nay duoc add tay de
/// khong phai sinh lai toan bo model. Toan bo mapping nam o day de co the
/// doc/kiem tra doc lap.</para>
/// </summary>
public partial class CoTuongDbContext
{
    /// <summary>
    /// Bat/tat mapping bang mo rong.
    ///
    /// <para>
    /// Migration "Baseline" duoc sinh khi schema 24 bang goc da ton tai san trong
    /// database, nen snapshot cua no phai khong chua bang mo rong. Khi tao baseline,
    /// dat bien moi truong <c>CoTuong_IncludeYeuCauChongLap=false</c>; migration
    /// "AddYeuCauChongLap" duoc tao sau do voi flag <c>true</c> (ma dinh).</para>
    ///
    /// <para>
    /// Vao thoi diem van hanh (runtime), flag luon la <c>true</c> de app su dung
    /// duoc bang idempotency.</para>
    /// </summary>
    private static readonly bool _includeYeuCauChongLap =
        Environment.GetEnvironmentVariable("CoTuong_IncludeYeuCauChongLap") == "false" ? false : true;

    /// <summary>
    /// App dung cho bang mo rong <c>yeu_cau_chong_lap</c>.
    /// </summary>
    partial void OnModelCreating_Extensions(ModelBuilder modelBuilder);

    private void ApplyYeuCauChongLap(ModelBuilder modelBuilder)
    {
        if (!_includeYeuCauChongLap)
        {
            // Bo luu y: DbSet property van khai bao thuc the nen phai Ignore
            // de model design-time khong yeu cau dinh nghia khoa cho no.
            modelBuilder.Ignore<yeu_cau_chong_lap>();
            return;
        }

        modelBuilder.Entity<yeu_cau_chong_lap>(entity =>
        {
            entity.ToTable("yeu_cau_chong_lap");

            entity.HasKey(e => e.ma);

            entity.Property(e => e.ma).ValueGeneratedOnAdd();

            entity.Property(e => e.khoa_idempotency)
                .HasMaxLength(64)
                .IsUnicode();

            entity.Property(e => e.loai_yeu_cau)
                .HasMaxLength(30)
                .IsUnicode(false);

            entity.Property(e => e.ket_qua_bam)
                .HasColumnType("nvarchar(max)");

            entity.Property(e => e.ngay_tao)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())", "DF_yc_cl_tao");

            entity.HasOne(d => d.ma_nguoi_dungNavigation)
                .WithMany()
                .HasForeignKey(d => d.ma_nguoi_dung)
                // Kiep voi script 01_schema_phase1.sql: FK_yc_cl_nguoi_dung khong co
                // ON DELETE => NO ACTION (cong thuong la Cascade).
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_yc_cl_nguoi_dung");

            entity.HasIndex(e => new { e.ma_nguoi_dung, e.loai_yeu_cau, e.khoa_idempotency },
                "UX_yc_cl_nguoi_loai_khoa").IsUnique();

            entity.HasIndex(e => e.ngay_tao, "IX_yc_cl_ngay_tao");
        });
    }
}
