using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoTuong.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Baseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "giao_dien_ban_co",
                columns: table => new
                {
                    ma = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_dinh_danh = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    ten = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    anh_xem_truoc = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    dang_hoat_dong = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ban_co_giao_dien_hoat_dong"),
                    thu_tu_sap_xep = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_giao_dien_ban_co", x => x.ma);
                });

            migrationBuilder.CreateTable(
                name: "nguoi_dung",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ten_dang_nhap = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ten_hien_thi = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    mat_khau_bam = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    anh_dai_dien = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    dang_hoat_dong = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_nguoi_dung_la_hoat_dong"),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_nguoi_dung_tao_luc"),
                    ngay_cap_nhat = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_nguoi_dung_cap_nhat_luc"),
                    thoi_diem_doi_mat_khau = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    lan_dang_nhap_cuoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nguoi_dung", x => x.ma);
                });

            migrationBuilder.CreateTable(
                name: "cai_dat_nguoi_dung",
                columns: table => new
                {
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    ma_giao_dien_ban_co = table.Column<int>(type: "int", nullable: true),
                    bat_am_thanh = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_nguoi_dung_cai_dat_am_thanh"),
                    ngay_cap_nhat = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_nguoi_dung_cai_dat_cap_nhat")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cai_dat_nguoi_dung", x => x.ma_nguoi_dung);
                    table.ForeignKey(
                        name: "FK_nguoi_dung_cai_dat_giao_dien",
                        column: x => x.ma_giao_dien_ban_co,
                        principalTable: "giao_dien_ban_co",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_nguoi_dung_cai_dat_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "ket_noi_nguoi_dung",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    ma_ket_noi = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    thoi_diem_ket_noi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_ket_noi_nd_ket_noi"),
                    lan_thay_cuoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_ket_noi_nd_thay"),
                    thoi_diem_ngat_ket_noi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ket_noi_nguoi_dung", x => x.ma);
                    table.ForeignKey(
                        name: "FK_ket_noi_nd_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "loi_moi_ket_ban",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_nguoi_gui = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_nhan = table.Column<long>(type: "bigint", nullable: false),
                    trang_thai = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false, defaultValue: "Pending")
                        .Annotation("Relational:DefaultConstraintName", "DF_loi_moi_kb_trang_thai"),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_loi_moi_kb_tao"),
                    thoi_diem_phan_hoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    ma_nguoi_dung_nho = table.Column<long>(type: "bigint", nullable: false, computedColumnSql: "(case when [ma_nguoi_gui]<[ma_nguoi_nhan] then [ma_nguoi_gui] else [ma_nguoi_nhan] end)", stored: true),
                    ma_nguoi_dung_lon = table.Column<long>(type: "bigint", nullable: false, computedColumnSql: "(case when [ma_nguoi_gui]<[ma_nguoi_nhan] then [ma_nguoi_nhan] else [ma_nguoi_gui] end)", stored: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loi_moi_ket_ban", x => x.ma);
                    table.ForeignKey(
                        name: "FK_loi_moi_kb_nguoi_gui",
                        column: x => x.ma_nguoi_gui,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_loi_moi_kb_nguoi_nhan",
                        column: x => x.ma_nguoi_nhan,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "phien_dang_nhap",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    refresh_token_bam = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    trinh_duyet = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    dia_chi_ip = table.Column<string>(type: "varchar(45)", unicode: false, maxLength: 45, nullable: true),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_nguoi_dung_phien_tao"),
                    lan_dung_cuoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_diem_het_han = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    thoi_diem_thu_hoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_phien_dang_nhap", x => x.ma);
                    table.ForeignKey(
                        name: "FK_nguoi_dung_phien_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "phong",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_so_phong = table.Column<string>(type: "char(6)", unicode: false, fixedLength: true, maxLength: 6, nullable: false),
                    token_moi = table.Column<string>(type: "char(32)", unicode: false, fixedLength: true, maxLength: 32, nullable: false),
                    ten = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    che_do_hien_thi = table.Column<string>(type: "varchar(7)", unicode: false, maxLength: 7, nullable: false),
                    trang_thai = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false, defaultValue: "WaitingOpponent")
                        .Annotation("Relational:DefaultConstraintName", "DF_phong_trang_thai"),
                    so_khan_gia_toi_da = table.Column<byte>(type: "tinyint", nullable: false, defaultValue: (byte)10)
                        .Annotation("Relational:DefaultConstraintName", "DF_phong_khan_gia_toi_da"),
                    ma_nguoi_tao = table.Column<long>(type: "bigint", nullable: false),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_phong_tao"),
                    ngay_cap_nhat = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_phong_cap_nhat"),
                    thoi_diem_dong = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_phong", x => x.ma);
                    table.ForeignKey(
                        name: "FK_phong_nguoi_tao",
                        column: x => x.ma_nguoi_tao,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "token_dat_lai_mat_khau",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    token_bam = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    trang_thai = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false, defaultValue: "Active")
                        .Annotation("Relational:DefaultConstraintName", "DF_token_dat_lai_trang_thai"),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_token_dat_lai_tao"),
                    thoi_diem_het_han = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    thoi_diem_su_dung = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_diem_thu_hoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    ip_yeu_cau = table.Column<string>(type: "varchar(45)", unicode: false, maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_token_dat_lai_mat_khau", x => x.ma);
                    table.ForeignKey(
                        name: "FK_token_dat_lai_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "yeu_cau_dat_lai_mat_khau",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: true),
                    ip_yeu_cau = table.Column<string>(type: "varchar(45)", unicode: false, maxLength: 45, nullable: true),
                    thoi_diem_yeu_cau = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_yc_dat_lai_yeu_cau")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_yeu_cau_dat_lai_mat_khau", x => x.ma);
                    table.ForeignKey(
                        name: "FK_yc_dat_lai_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "ban_be",
                columns: table => new
                {
                    ma_nguoi_dung_nho = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_dung_lon = table.Column<long>(type: "bigint", nullable: false),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_ban_be_tao"),
                    ma_loi_moi_nguon = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ban_be", x => new { x.ma_nguoi_dung_nho, x.ma_nguoi_dung_lon });
                    table.ForeignKey(
                        name: "FK_ban_be_lon",
                        column: x => x.ma_nguoi_dung_lon,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_ban_be_nho",
                        column: x => x.ma_nguoi_dung_nho,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_ban_be_yeu_cau",
                        column: x => x.ma_loi_moi_nguon,
                        principalTable: "loi_moi_ket_ban",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "cam_vao_phong",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_phong = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_cam = table.Column<long>(type: "bigint", nullable: false),
                    thoi_diem_bi_cam = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_cam_phong_luc")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cam_vao_phong", x => x.ma);
                    table.ForeignKey(
                        name: "FK_cam_phong_boi",
                        column: x => x.ma_nguoi_cam,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_cam_phong_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_cam_phong_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "cuoc_goi_video",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_phong = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_goi = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_nhan_cuoc_goi = table.Column<long>(type: "bigint", nullable: false),
                    trang_thai = table.Column<string>(type: "varchar(9)", unicode: false, maxLength: 9, nullable: false, defaultValue: "Ringing")
                        .Annotation("Relational:DefaultConstraintName", "DF_cuoc_goi_trang_thai"),
                    thoi_diem_yeu_cau = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_cuoc_goi_yeu_cau"),
                    thoi_diem_het_han = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    thoi_diem_tra_loi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_diem_ket_thuc = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    ly_do_ket_thuc = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cuoc_goi_video", x => x.ma);
                    table.ForeignKey(
                        name: "FK_cuoc_goi_nguoi_goi",
                        column: x => x.ma_nguoi_goi,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_cuoc_goi_nguoi_nhan",
                        column: x => x.ma_nguoi_nhan_cuoc_goi,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_cuoc_goi_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "loi_moi_vao_phong",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_phong = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_moi = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_duoc_moi = table.Column<long>(type: "bigint", nullable: false),
                    trang_thai = table.Column<string>(type: "varchar(11)", unicode: false, maxLength: 11, nullable: false, defaultValue: "Pending")
                        .Annotation("Relational:DefaultConstraintName", "DF_loi_moi_phong_trang_thai"),
                    thoi_diem_gui = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_loi_moi_phong_gui"),
                    thoi_diem_het_han = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    thoi_diem_phan_hoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loi_moi_vao_phong", x => x.ma);
                    table.ForeignKey(
                        name: "FK_loi_moi_phong_nguoi_duoc_moi",
                        column: x => x.ma_nguoi_duoc_moi,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_loi_moi_phong_nguoi_moi",
                        column: x => x.ma_nguoi_moi,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_loi_moi_phong_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "su_kien_thanh_vien_phong",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_phong = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_thuc_hien = table.Column<long>(type: "bigint", nullable: true),
                    loai_su_kien = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    vai_tro_cu = table.Column<string>(type: "varchar(9)", unicode: false, maxLength: 9, nullable: true),
                    vai_tro_moi = table.Column<string>(type: "varchar(9)", unicode: false, maxLength: 9, nullable: true),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_sk_tv_phong_tao")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_su_kien_thanh_vien_phong", x => x.ma);
                    table.ForeignKey(
                        name: "FK_sk_tv_phong_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_sk_tv_phong_nguoi_thuc_hien",
                        column: x => x.ma_nguoi_thuc_hien,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_sk_tv_phong_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "thanh_vien_phong",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_phong = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    vai_tro = table.Column<string>(type: "varchar(9)", unicode: false, maxLength: 9, nullable: false),
                    san_sang = table.Column<bool>(type: "bit", nullable: false),
                    thoi_diem_san_sang = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_diem_vao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_tv_phong_vao"),
                    thoi_diem_nhan_vai_tro = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_tv_phong_vai_tro_luc"),
                    nguon_tham_gia = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: true),
                    thoi_diem_roi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    ly_do_roi = table.Column<string>(type: "varchar(12)", unicode: false, maxLength: 12, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_thanh_vien_phong", x => x.ma);
                    table.ForeignKey(
                        name: "FK_tv_phong_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_tv_phong_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "tin_nhan_phong",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_phong = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_gui_tin = table.Column<long>(type: "bigint", nullable: false),
                    ma_chu_phong = table.Column<long>(type: "bigint", nullable: false),
                    ma_doi_thu = table.Column<long>(type: "bigint", nullable: false),
                    noi_dung = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    thoi_diem_gui = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_tin_nhan_gui")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tin_nhan_phong", x => x.ma);
                    table.ForeignKey(
                        name: "FK_tin_nhan_chu_phong",
                        column: x => x.ma_chu_phong,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_tin_nhan_doi_thu",
                        column: x => x.ma_doi_thu,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_tin_nhan_nguoi_gui",
                        column: x => x.ma_nguoi_gui_tin,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_tin_nhan_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "tran_dau",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    loai_tran = table.Column<string>(type: "varchar(3)", unicode: false, maxLength: 3, nullable: false),
                    ma_phong = table.Column<long>(type: "bigint", nullable: true),
                    ma_nguoi_tao = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_choi_do = table.Column<long>(type: "bigint", nullable: true),
                    ma_nguoi_choi_den = table.Column<long>(type: "bigint", nullable: true),
                    ben_cua_may = table.Column<string>(type: "varchar(5)", unicode: false, maxLength: 5, nullable: true),
                    trang_thai = table.Column<string>(type: "varchar(15)", unicode: false, maxLength: 15, nullable: false, defaultValue: "Countdown")
                        .Annotation("Relational:DefaultConstraintName", "DF_tran_dau_trang_thai"),
                    ben_den_luot = table.Column<string>(type: "varchar(5)", unicode: false, maxLength: 5, nullable: false, defaultValue: "Red")
                        .Annotation("Relational:DefaultConstraintName", "DF_tran_dau_den_luot"),
                    so_nuoc_di = table.Column<int>(type: "int", nullable: false),
                    ben_bi_chieu = table.Column<string>(type: "varchar(5)", unicode: false, maxLength: 5, nullable: true),
                    gioi_han_luot_giay = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)60)
                        .Annotation("Relational:DefaultConstraintName", "DF_tran_dau_gioi_han"),
                    thoi_diem_bat_dau_luot = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_gian_con_lai_ms = table.Column<int>(type: "int", nullable: true),
                    phien_ban_trang_thai = table.Column<int>(type: "int", nullable: false),
                    ket_qua = table.Column<string>(type: "varchar(8)", unicode: false, maxLength: 8, nullable: true),
                    ly_do_ket_thuc = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: true),
                    ma_nguoi_thang = table.Column<long>(type: "bigint", nullable: true, computedColumnSql: "(case [ket_qua] when 'RedWin' then [ma_nguoi_choi_do] when 'BlackWin' then [ma_nguoi_choi_den]  end)", stored: true),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_tran_dau_tao"),
                    thoi_diem_bat_dau_dem_nguoc = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_diem_bat_dau = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_diem_nuoc_di_cuoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    thoi_diem_ket_thuc = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tran_dau", x => x.ma);
                    table.ForeignKey(
                        name: "FK_tran_dau_den",
                        column: x => x.ma_nguoi_choi_den,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_tran_dau_do",
                        column: x => x.ma_nguoi_choi_do,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_tran_dau_nguoi_tao",
                        column: x => x.ma_nguoi_tao,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_tran_dau_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "nguoi_tham_gia_cuoc_goi",
                columns: table => new
                {
                    ma_cuoc_goi = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    thoi_diem_vao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_tg_cuoc_goi_vao"),
                    thoi_diem_roi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    chi_am_thanh = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nguoi_tham_gia_cuoc_goi", x => new { x.ma_cuoc_goi, x.ma_nguoi_dung });
                    table.ForeignKey(
                        name: "FK_tg_cuoc_goi_goi",
                        column: x => x.ma_cuoc_goi,
                        principalTable: "cuoc_goi_video",
                        principalColumn: "ma",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tg_cuoc_goi_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "thong_bao",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    loai = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    ma_nguoi_thuc_hien = table.Column<long>(type: "bigint", nullable: true),
                    ma_loi_moi_ket_ban = table.Column<long>(type: "bigint", nullable: true),
                    ma_loi_moi_vao_phong = table.Column<long>(type: "bigint", nullable: true),
                    ma_phong = table.Column<long>(type: "bigint", nullable: true),
                    du_lieu_phu = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    da_doc = table.Column<bool>(type: "bit", nullable: false),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_thong_bao_tao"),
                    thoi_diem_doc = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_thong_bao", x => x.ma);
                    table.ForeignKey(
                        name: "FK_thong_bao_loi_moi_kb",
                        column: x => x.ma_loi_moi_ket_ban,
                        principalTable: "loi_moi_ket_ban",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_thong_bao_loi_moi_phong",
                        column: x => x.ma_loi_moi_vao_phong,
                        principalTable: "loi_moi_vao_phong",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_thong_bao_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_thong_bao_nguoi_thuc_hien",
                        column: x => x.ma_nguoi_thuc_hien,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_thong_bao_phong",
                        column: x => x.ma_phong,
                        principalTable: "phong",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateTable(
                name: "de_nghi_hoa",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_tran_dau = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_de_nghi = table.Column<long>(type: "bigint", nullable: false),
                    trang_thai = table.Column<string>(type: "varchar(9)", unicode: false, maxLength: 9, nullable: false, defaultValue: "Pending")
                        .Annotation("Relational:DefaultConstraintName", "DF_de_nghi_hoa_trang_thai"),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_de_nghi_hoa_tao"),
                    thoi_diem_phan_hoi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_de_nghi_hoa", x => x.ma);
                    table.ForeignKey(
                        name: "FK_de_nghi_hoa_nguoi_dung",
                        column: x => x.ma_nguoi_de_nghi,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_de_nghi_hoa_tran",
                        column: x => x.ma_tran_dau,
                        principalTable: "tran_dau",
                        principalColumn: "ma",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mat_ket_noi_tran_dau",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_tran_dau = table.Column<long>(type: "bigint", nullable: false),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    thoi_diem_ngat_ket_noi = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_mat_kn_ngat_kn"),
                    han_ket_noi_lai = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false),
                    thoi_diem_ket_noi_lai = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: true),
                    trang_thai = table.Column<string>(type: "varchar(11)", unicode: false, maxLength: 11, nullable: false, defaultValue: "Waiting")
                        .Annotation("Relational:DefaultConstraintName", "DF_mat_kn_trang_thai")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mat_ket_noi_tran_dau", x => x.ma);
                    table.ForeignKey(
                        name: "FK_mat_kn_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_mat_kn_tran",
                        column: x => x.ma_tran_dau,
                        principalTable: "tran_dau",
                        principalColumn: "ma",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quan_co_tran_dau",
                columns: table => new
                {
                    ma_tran_dau = table.Column<long>(type: "bigint", nullable: false),
                    so_quan = table.Column<byte>(type: "tinyint", nullable: false),
                    ben = table.Column<string>(type: "varchar(5)", unicode: false, maxLength: 5, nullable: false),
                    loai_quan = table.Column<string>(type: "varchar(8)", unicode: false, maxLength: 8, nullable: false),
                    x_ban_dau = table.Column<byte>(type: "tinyint", nullable: false),
                    y_ban_dau = table.Column<byte>(type: "tinyint", nullable: false),
                    x_hien_tai = table.Column<byte>(type: "tinyint", nullable: true),
                    y_hien_tai = table.Column<byte>(type: "tinyint", nullable: true),
                    da_bi_an = table.Column<bool>(type: "bit", nullable: false),
                    bi_an_o_nuoc_thu = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quan_co_tran_dau", x => new { x.ma_tran_dau, x.so_quan });
                    table.ForeignKey(
                        name: "FK_quan_co_tran",
                        column: x => x.ma_tran_dau,
                        principalTable: "tran_dau",
                        principalColumn: "ma",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "su_kien_tran_dau",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_tran_dau = table.Column<long>(type: "bigint", nullable: false),
                    loai_su_kien = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    ma_nguoi_thuc_hien = table.Column<long>(type: "bigint", nullable: true),
                    chi_tiet = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_sk_tran_tao")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_su_kien_tran_dau", x => x.ma);
                    table.ForeignKey(
                        name: "FK_sk_tran_nguoi_thuc_hien",
                        column: x => x.ma_nguoi_thuc_hien,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_sk_tran_tran",
                        column: x => x.ma_tran_dau,
                        principalTable: "tran_dau",
                        principalColumn: "ma",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "nuoc_di_tran_dau",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_tran_dau = table.Column<long>(type: "bigint", nullable: false),
                    so_thu_tu_nuoc_di = table.Column<int>(type: "int", nullable: false),
                    ben = table.Column<string>(type: "varchar(5)", unicode: false, maxLength: 5, nullable: false),
                    ma_nguoi_di = table.Column<long>(type: "bigint", nullable: true),
                    so_quan = table.Column<byte>(type: "tinyint", nullable: false),
                    tu_x = table.Column<byte>(type: "tinyint", nullable: false),
                    tu_y = table.Column<byte>(type: "tinyint", nullable: false),
                    den_x = table.Column<byte>(type: "tinyint", nullable: false),
                    den_y = table.Column<byte>(type: "tinyint", nullable: false),
                    so_quan_bi_an = table.Column<byte>(type: "tinyint", nullable: true),
                    gay_chieu = table.Column<bool>(type: "bit", nullable: false),
                    ky_hieu = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    thoi_gian_di_ms = table.Column<int>(type: "int", nullable: true),
                    ma_nuoc_di_client = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_nuoc_di_tao")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nuoc_di_tran_dau", x => x.ma);
                    table.ForeignKey(
                        name: "FK_nuoc_di_bi_an",
                        columns: x => new { x.ma_tran_dau, x.so_quan_bi_an },
                        principalTable: "quan_co_tran_dau",
                        principalColumns: new[] { "ma_tran_dau", "so_quan" });
                    table.ForeignKey(
                        name: "FK_nuoc_di_nguoi_di",
                        column: x => x.ma_nguoi_di,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                    table.ForeignKey(
                        name: "FK_nuoc_di_quan",
                        columns: x => new { x.ma_tran_dau, x.so_quan },
                        principalTable: "quan_co_tran_dau",
                        principalColumns: new[] { "ma_tran_dau", "so_quan" });
                    table.ForeignKey(
                        name: "FK_nuoc_di_tran",
                        column: x => x.ma_tran_dau,
                        principalTable: "tran_dau",
                        principalColumn: "ma",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ban_be_lon",
                table: "ban_be",
                columns: new[] { "ma_nguoi_dung_lon", "ma_nguoi_dung_nho" });

            migrationBuilder.CreateIndex(
                name: "IX_ban_be_ma_loi_moi_nguon",
                table: "ban_be",
                column: "ma_loi_moi_nguon");

            migrationBuilder.CreateIndex(
                name: "IX_cai_dat_nguoi_dung_ma_giao_dien_ban_co",
                table: "cai_dat_nguoi_dung",
                column: "ma_giao_dien_ban_co");

            migrationBuilder.CreateIndex(
                name: "IX_cam_vao_phong_ma_nguoi_cam",
                table: "cam_vao_phong",
                column: "ma_nguoi_cam");

            migrationBuilder.CreateIndex(
                name: "IX_cam_vao_phong_ma_nguoi_dung",
                table: "cam_vao_phong",
                column: "ma_nguoi_dung");

            migrationBuilder.CreateIndex(
                name: "UX_cam_phong_phong_nguoi_dung",
                table: "cam_vao_phong",
                columns: new[] { "ma_phong", "ma_nguoi_dung" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_cuoc_goi_nguoi_nhan",
                table: "cuoc_goi_video",
                columns: new[] { "ma_nguoi_nhan_cuoc_goi", "trang_thai" });

            migrationBuilder.CreateIndex(
                name: "IX_cuoc_goi_video_ma_nguoi_goi",
                table: "cuoc_goi_video",
                column: "ma_nguoi_goi");

            migrationBuilder.CreateIndex(
                name: "UX_cuoc_goi_mot_dang_goi_moi_phong",
                table: "cuoc_goi_video",
                column: "ma_phong",
                unique: true,
                filter: "([trang_thai] IN ('Ringing', 'Active'))");

            migrationBuilder.CreateIndex(
                name: "IX_de_nghi_hoa_ma_nguoi_de_nghi",
                table: "de_nghi_hoa",
                column: "ma_nguoi_de_nghi");

            migrationBuilder.CreateIndex(
                name: "UX_de_nghi_hoa_mot_dang_cho",
                table: "de_nghi_hoa",
                column: "ma_tran_dau",
                unique: true,
                filter: "([trang_thai]='Pending')");

            migrationBuilder.CreateIndex(
                name: "UX_ban_co_giao_dien_ma",
                table: "giao_dien_ban_co",
                column: "ma_dinh_danh",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ket_noi_nd_heartbeat",
                table: "ket_noi_nguoi_dung",
                columns: new[] { "lan_thay_cuoi", "ma_nguoi_dung" },
                filter: "([thoi_diem_ngat_ket_noi] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_ket_noi_nd_nguoi_dung_hoat_dong",
                table: "ket_noi_nguoi_dung",
                column: "ma_nguoi_dung",
                filter: "([thoi_diem_ngat_ket_noi] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "UX_ket_noi_nd_ket_noi_ma",
                table: "ket_noi_nguoi_dung",
                column: "ma_ket_noi",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_loi_moi_kb_nguoi_gui_dang_cho",
                table: "loi_moi_ket_ban",
                columns: new[] { "ma_nguoi_gui", "trang_thai" });

            migrationBuilder.CreateIndex(
                name: "IX_loi_moi_kb_nguoi_nhan_dang_cho",
                table: "loi_moi_ket_ban",
                columns: new[] { "ma_nguoi_nhan", "trang_thai" });

            migrationBuilder.CreateIndex(
                name: "UX_loi_moi_kb_mot_dang_cho_moi_cap",
                table: "loi_moi_ket_ban",
                columns: new[] { "ma_nguoi_dung_nho", "ma_nguoi_dung_lon" },
                unique: true,
                filter: "([trang_thai]='Pending')");

            migrationBuilder.CreateIndex(
                name: "IX_loi_moi_phong_nguoi_duoc_moi_dang_cho",
                table: "loi_moi_vao_phong",
                columns: new[] { "ma_nguoi_duoc_moi", "trang_thai", "thoi_diem_het_han" });

            migrationBuilder.CreateIndex(
                name: "IX_loi_moi_phong_phong",
                table: "loi_moi_vao_phong",
                columns: new[] { "ma_phong", "trang_thai" });

            migrationBuilder.CreateIndex(
                name: "UX_loi_moi_phong_mot_dang_cho_moi_nguoi_moi",
                table: "loi_moi_vao_phong",
                column: "ma_nguoi_moi",
                unique: true,
                filter: "([trang_thai]='Pending')");

            migrationBuilder.CreateIndex(
                name: "IX_mat_ket_noi_tran_dau_ma_nguoi_dung",
                table: "mat_ket_noi_tran_dau",
                column: "ma_nguoi_dung");

            migrationBuilder.CreateIndex(
                name: "IX_mat_kn_han",
                table: "mat_ket_noi_tran_dau",
                column: "han_ket_noi_lai",
                filter: "([trang_thai]='Waiting')");

            migrationBuilder.CreateIndex(
                name: "UX_mat_kn_mot_dang_cho",
                table: "mat_ket_noi_tran_dau",
                columns: new[] { "ma_tran_dau", "ma_nguoi_dung" },
                unique: true,
                filter: "([trang_thai]='Waiting')");

            migrationBuilder.CreateIndex(
                name: "IX_nguoi_dung_hien_thi_ten",
                table: "nguoi_dung",
                column: "ten_hien_thi");

            migrationBuilder.CreateIndex(
                name: "UX_nguoi_dung_email",
                table: "nguoi_dung",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_nguoi_dung_ten_dang_nhap",
                table: "nguoi_dung",
                column: "ten_dang_nhap",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_nguoi_tham_gia_cuoc_goi_ma_nguoi_dung",
                table: "nguoi_tham_gia_cuoc_goi",
                column: "ma_nguoi_dung");

            migrationBuilder.CreateIndex(
                name: "IX_nuoc_di_tran_dau_ma_nguoi_di",
                table: "nuoc_di_tran_dau",
                column: "ma_nguoi_di");

            migrationBuilder.CreateIndex(
                name: "IX_nuoc_di_tran_dau_ma_tran_dau_so_quan",
                table: "nuoc_di_tran_dau",
                columns: new[] { "ma_tran_dau", "so_quan" });

            migrationBuilder.CreateIndex(
                name: "IX_nuoc_di_tran_dau_ma_tran_dau_so_quan_bi_an",
                table: "nuoc_di_tran_dau",
                columns: new[] { "ma_tran_dau", "so_quan_bi_an" });

            migrationBuilder.CreateIndex(
                name: "UX_nuoc_di_client_nuoc_di",
                table: "nuoc_di_tran_dau",
                columns: new[] { "ma_tran_dau", "ma_nuoc_di_client" },
                unique: true,
                filter: "([ma_nuoc_di_client] IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "UX_nuoc_di_tran_nuoc_di",
                table: "nuoc_di_tran_dau",
                columns: new[] { "ma_tran_dau", "so_thu_tu_nuoc_di" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_nguoi_dung_phien_nguoi_dung",
                table: "phien_dang_nhap",
                columns: new[] { "ma_nguoi_dung", "thoi_diem_thu_hoi", "thoi_diem_het_han" });

            migrationBuilder.CreateIndex(
                name: "UX_nguoi_dung_phien_token",
                table: "phien_dang_nhap",
                column: "refresh_token_bam",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_phong_cong_khai_danh_sach",
                table: "phong",
                columns: new[] { "che_do_hien_thi", "trang_thai", "ngay_tao" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_phong_ma_nguoi_tao",
                table: "phong",
                column: "ma_nguoi_tao");

            migrationBuilder.CreateIndex(
                name: "UX_phong_ma_hoat_dong",
                table: "phong",
                column: "ma_so_phong",
                unique: true,
                filter: "([trang_thai]<>'Closed')");

            migrationBuilder.CreateIndex(
                name: "UX_phong_moi_token",
                table: "phong",
                column: "token_moi",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_quan_co_o",
                table: "quan_co_tran_dau",
                columns: new[] { "ma_tran_dau", "x_hien_tai", "y_hien_tai" },
                unique: true,
                filter: "([da_bi_an]=(0))");

            migrationBuilder.CreateIndex(
                name: "UX_quan_co_vi_tri_ban_dau",
                table: "quan_co_tran_dau",
                columns: new[] { "ma_tran_dau", "x_ban_dau", "y_ban_dau" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sk_tv_phong_phong_thoi_gian",
                table: "su_kien_thanh_vien_phong",
                columns: new[] { "ma_phong", "ngay_tao" });

            migrationBuilder.CreateIndex(
                name: "IX_su_kien_thanh_vien_phong_ma_nguoi_dung",
                table: "su_kien_thanh_vien_phong",
                column: "ma_nguoi_dung");

            migrationBuilder.CreateIndex(
                name: "IX_su_kien_thanh_vien_phong_ma_nguoi_thuc_hien",
                table: "su_kien_thanh_vien_phong",
                column: "ma_nguoi_thuc_hien");

            migrationBuilder.CreateIndex(
                name: "IX_sk_tran_tran_thoi_gian",
                table: "su_kien_tran_dau",
                columns: new[] { "ma_tran_dau", "ngay_tao" });

            migrationBuilder.CreateIndex(
                name: "IX_su_kien_tran_dau_ma_nguoi_thuc_hien",
                table: "su_kien_tran_dau",
                column: "ma_nguoi_thuc_hien");

            migrationBuilder.CreateIndex(
                name: "IX_tv_phong_nguoi_dung_hoat_dong",
                table: "thanh_vien_phong",
                column: "ma_nguoi_dung",
                filter: "([thoi_diem_roi] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_tv_phong_phong_khan_gia",
                table: "thanh_vien_phong",
                columns: new[] { "ma_phong", "thoi_diem_vao" },
                filter: "([vai_tro]='Spectator' AND [thoi_diem_roi] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "UX_tv_phong_hoat_dong_thanh_vien",
                table: "thanh_vien_phong",
                columns: new[] { "ma_phong", "ma_nguoi_dung" },
                unique: true,
                filter: "([thoi_diem_roi] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "UX_tv_phong_mot_chu_phong",
                table: "thanh_vien_phong",
                column: "ma_phong",
                unique: true,
                filter: "([vai_tro]='Host' AND [thoi_diem_roi] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "UX_tv_phong_mot_doi_thu",
                table: "thanh_vien_phong",
                column: "ma_phong",
                unique: true,
                filter: "([vai_tro]='Opponent' AND [thoi_diem_roi] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_thong_bao_ma_loi_moi_ket_ban",
                table: "thong_bao",
                column: "ma_loi_moi_ket_ban");

            migrationBuilder.CreateIndex(
                name: "IX_thong_bao_ma_loi_moi_vao_phong",
                table: "thong_bao",
                column: "ma_loi_moi_vao_phong");

            migrationBuilder.CreateIndex(
                name: "IX_thong_bao_ma_nguoi_thuc_hien",
                table: "thong_bao",
                column: "ma_nguoi_thuc_hien");

            migrationBuilder.CreateIndex(
                name: "IX_thong_bao_ma_phong",
                table: "thong_bao",
                column: "ma_phong");

            migrationBuilder.CreateIndex(
                name: "IX_thong_bao_nguoi_dung_chua_doc",
                table: "thong_bao",
                columns: new[] { "ma_nguoi_dung", "da_doc", "ngay_tao" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_tin_nhan_phong_ma_chu_phong",
                table: "tin_nhan_phong",
                column: "ma_chu_phong");

            migrationBuilder.CreateIndex(
                name: "IX_tin_nhan_phong_ma_doi_thu",
                table: "tin_nhan_phong",
                column: "ma_doi_thu");

            migrationBuilder.CreateIndex(
                name: "IX_tin_nhan_phong_ma_nguoi_gui_tin",
                table: "tin_nhan_phong",
                column: "ma_nguoi_gui_tin");

            migrationBuilder.CreateIndex(
                name: "IX_tin_nhan_phong_thoi_gian",
                table: "tin_nhan_phong",
                columns: new[] { "ma_phong", "thoi_diem_gui" });

            migrationBuilder.CreateIndex(
                name: "UX_token_dat_lai_mot_hoat_dong_moi_nguoi_dung",
                table: "token_dat_lai_mat_khau",
                column: "ma_nguoi_dung",
                unique: true,
                filter: "([trang_thai]='Active')");

            migrationBuilder.CreateIndex(
                name: "UX_token_dat_lai_token_bam",
                table: "token_dat_lai_mat_khau",
                column: "token_bam",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tran_dau_den",
                table: "tran_dau",
                columns: new[] { "ma_nguoi_choi_den", "trang_thai", "thoi_diem_ket_thuc" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_tran_dau_do",
                table: "tran_dau",
                columns: new[] { "ma_nguoi_choi_do", "trang_thai", "thoi_diem_ket_thuc" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_tran_dau_hoat_dong",
                table: "tran_dau",
                column: "trang_thai",
                filter: "([trang_thai]<>'Finished')");

            migrationBuilder.CreateIndex(
                name: "IX_tran_dau_ma_nguoi_tao",
                table: "tran_dau",
                column: "ma_nguoi_tao");

            migrationBuilder.CreateIndex(
                name: "IX_tran_dau_phong",
                table: "tran_dau",
                columns: new[] { "ma_phong", "ngay_tao" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "UX_tran_dau_mot_active_room",
                table: "tran_dau",
                column: "ma_phong",
                unique: true,
                filter: "([ma_phong] IS NOT NULL AND [trang_thai]<>'Finished')");

            migrationBuilder.CreateIndex(
                name: "IX_yc_dat_lai_email_thoi_gian",
                table: "yeu_cau_dat_lai_mat_khau",
                columns: new[] { "email", "thoi_diem_yeu_cau" });

            migrationBuilder.CreateIndex(
                name: "IX_yc_dat_lai_ip_thoi_gian",
                table: "yeu_cau_dat_lai_mat_khau",
                columns: new[] { "ip_yeu_cau", "thoi_diem_yeu_cau" });

            migrationBuilder.CreateIndex(
                name: "IX_yeu_cau_dat_lai_mat_khau_ma_nguoi_dung",
                table: "yeu_cau_dat_lai_mat_khau",
                column: "ma_nguoi_dung");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ban_be");

            migrationBuilder.DropTable(
                name: "cai_dat_nguoi_dung");

            migrationBuilder.DropTable(
                name: "cam_vao_phong");

            migrationBuilder.DropTable(
                name: "de_nghi_hoa");

            migrationBuilder.DropTable(
                name: "ket_noi_nguoi_dung");

            migrationBuilder.DropTable(
                name: "mat_ket_noi_tran_dau");

            migrationBuilder.DropTable(
                name: "nguoi_tham_gia_cuoc_goi");

            migrationBuilder.DropTable(
                name: "nuoc_di_tran_dau");

            migrationBuilder.DropTable(
                name: "phien_dang_nhap");

            migrationBuilder.DropTable(
                name: "su_kien_thanh_vien_phong");

            migrationBuilder.DropTable(
                name: "su_kien_tran_dau");

            migrationBuilder.DropTable(
                name: "thanh_vien_phong");

            migrationBuilder.DropTable(
                name: "thong_bao");

            migrationBuilder.DropTable(
                name: "tin_nhan_phong");

            migrationBuilder.DropTable(
                name: "token_dat_lai_mat_khau");

            migrationBuilder.DropTable(
                name: "yeu_cau_dat_lai_mat_khau");

            migrationBuilder.DropTable(
                name: "giao_dien_ban_co");

            migrationBuilder.DropTable(
                name: "cuoc_goi_video");

            migrationBuilder.DropTable(
                name: "quan_co_tran_dau");

            migrationBuilder.DropTable(
                name: "loi_moi_ket_ban");

            migrationBuilder.DropTable(
                name: "loi_moi_vao_phong");

            migrationBuilder.DropTable(
                name: "tran_dau");

            migrationBuilder.DropTable(
                name: "phong");

            migrationBuilder.DropTable(
                name: "nguoi_dung");
        }
    }
}
