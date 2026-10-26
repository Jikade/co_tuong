using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoTuong.Infrastructure.Persistence.Migrations;

/// <summary>Adds the Phase 1 idempotency table when the base schema predates it.</summary>
public partial class AddYeuCauChongLap : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF OBJECT_ID(N'dbo.yeu_cau_chong_lap', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.yeu_cau_chong_lap (
                    ma BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_yeu_cau_chong_lap PRIMARY KEY,
                    ma_nguoi_dung BIGINT NOT NULL CONSTRAINT FK_yc_cl_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
                    khoa_idempotency NVARCHAR(64) NOT NULL,
                    loai_yeu_cau VARCHAR(30) NOT NULL,
                    ket_qua_bam NVARCHAR(MAX) NULL,
                    ngay_tao DATETIME2(3) NOT NULL CONSTRAINT DF_yc_cl_tao DEFAULT SYSUTCDATETIME(),
                    CONSTRAINT CK_yc_cl_loai CHECK (loai_yeu_cau IN
                        ('Register','Login','CreateRoom','JoinRoom','StartMatch','Ready',
                         'FriendRequest','RoomInvite','SendChat','ResetPassword')),
                    CONSTRAINT CK_yc_cl_khoa CHECK (LEN(LTRIM(RTRIM(khoa_idempotency))) > 0)
                );
                CREATE UNIQUE INDEX UX_yc_cl_nguoi_loai_khoa
                    ON dbo.yeu_cau_chong_lap(ma_nguoi_dung, loai_yeu_cau, khoa_idempotency);
                CREATE INDEX IX_yc_cl_ngay_tao ON dbo.yeu_cau_chong_lap(ngay_tao);
            END;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("IF OBJECT_ID(N'dbo.yeu_cau_chong_lap', N'U') IS NOT NULL DROP TABLE dbo.yeu_cau_chong_lap;");
    }
}
