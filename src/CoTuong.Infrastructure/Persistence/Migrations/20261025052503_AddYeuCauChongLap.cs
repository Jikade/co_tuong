using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoTuong.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddYeuCauChongLap : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "yeu_cau_chong_lap",
                columns: table => new
                {
                    ma = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ma_nguoi_dung = table.Column<long>(type: "bigint", nullable: false),
                    khoa_idempotency = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    loai_yeu_cau = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    ket_qua_bam = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ngay_tao = table.Column<DateTime>(type: "datetime2(3)", precision: 3, nullable: false, defaultValueSql: "(sysutcdatetime())")
                        .Annotation("Relational:DefaultConstraintName", "DF_yc_cl_tao")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_yeu_cau_chong_lap", x => x.ma);
                    table.ForeignKey(
                        name: "FK_yc_cl_nguoi_dung",
                        column: x => x.ma_nguoi_dung,
                        principalTable: "nguoi_dung",
                        principalColumn: "ma");
                });

            migrationBuilder.CreateIndex(
                name: "IX_yc_cl_ngay_tao",
                table: "yeu_cau_chong_lap",
                column: "ngay_tao");

            migrationBuilder.CreateIndex(
                name: "UX_yc_cl_nguoi_loai_khoa",
                table: "yeu_cau_chong_lap",
                columns: new[] { "ma_nguoi_dung", "loai_yeu_cau", "khoa_idempotency" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "yeu_cau_chong_lap");
        }
    }
}
