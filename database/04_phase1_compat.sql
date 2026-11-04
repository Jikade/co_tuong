-- Idempotent translation of the two EF migrations with DDL.
-- Baseline and CorrectPhase1RelationshipCardinality had no Up() DDL.
-- Does not recreate the base schema, modify users, or drop tables/indexes.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.nguoi_dung', N'U') IS NULL
    THROW 51000, 'Install the base schema first.', 1;
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
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.yeu_cau_chong_lap') AND name=N'UX_yc_cl_nguoi_loai_khoa')
    CREATE UNIQUE INDEX UX_yc_cl_nguoi_loai_khoa ON dbo.yeu_cau_chong_lap(ma_nguoi_dung,loai_yeu_cau,khoa_idempotency);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.yeu_cau_chong_lap') AND name=N'IX_yc_cl_ngay_tao')
    CREATE INDEX IX_yc_cl_ngay_tao ON dbo.yeu_cau_chong_lap(ngay_tao);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.yeu_cau_chong_lap') AND name=N'UX_yc_cl_register_khoa')
    CREATE UNIQUE INDEX UX_yc_cl_register_khoa ON dbo.yeu_cau_chong_lap(loai_yeu_cau,khoa_idempotency) WHERE loai_yeu_cau='Register';
COMMIT;
