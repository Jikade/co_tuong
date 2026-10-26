using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoTuong.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RegisterIdempotencyIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'dbo.yeu_cau_chong_lap', N'U') IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM sys.indexes
                                   WHERE object_id = OBJECT_ID(N'dbo.yeu_cau_chong_lap')
                                     AND name = N'UX_yc_cl_register_khoa')
                    CREATE UNIQUE INDEX UX_yc_cl_register_khoa
                        ON dbo.yeu_cau_chong_lap(loai_yeu_cau, khoa_idempotency)
                        WHERE loai_yeu_cau = 'Register';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // This uniqueness rule is included in the schema baseline and is not reversed.
        }
    }
}
