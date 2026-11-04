/*
   Du lieu mau Phase 1 cho moi truong test/dev.
   Tai khoan test01..test06 deu co mat khau: Test@1234
   Password hash dung ASP.NET Core Identity V3 (PBKDF2-HMAC-SHA512, 100000 vong).
   Script co the chay lai ma khong tao them tai khoan/quan he/Room.
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @now DATETIME2(3) = SYSUTCDATETIME();
DECLARE @passwordHash NVARCHAR(255) = N'AQAAAAIAAYagAAAAEENvVHVvbmdTZWVkU2FsdCF6DsIEooYjXrbRdeK10RBb24IO0CPwyeFK9uivIfwEqw==';

BEGIN TRANSACTION;

INSERT dbo.nguoi_dung (ten_dang_nhap, ten_hien_thi, email, mat_khau_bam, dang_hoat_dong, thoi_diem_doi_mat_khau)
SELECT v.ten_dang_nhap, v.ten_hien_thi, v.email, @passwordHash, 1, @now
FROM (VALUES
    (N'test01', N'Test Player 01', N'test01@cotuong.local'),
    (N'test02', N'Test Player 02', N'test02@cotuong.local'),
    (N'test03', N'Test Player 03', N'test03@cotuong.local'),
    (N'test04', N'Test Player 04', N'test04@cotuong.local'),
    (N'test05', N'Test Player 05', N'test05@cotuong.local'),
    (N'test06', N'Test Player 06', N'test06@cotuong.local')
) v(ten_dang_nhap, ten_hien_thi, email)
WHERE NOT EXISTS (SELECT 1 FROM dbo.nguoi_dung u WHERE u.ten_dang_nhap = v.ten_dang_nhap);

DECLARE @u1 BIGINT = (SELECT ma FROM dbo.nguoi_dung WHERE ten_dang_nhap = N'test01');
DECLARE @u2 BIGINT = (SELECT ma FROM dbo.nguoi_dung WHERE ten_dang_nhap = N'test02');
DECLARE @u3 BIGINT = (SELECT ma FROM dbo.nguoi_dung WHERE ten_dang_nhap = N'test03');
DECLARE @u4 BIGINT = (SELECT ma FROM dbo.nguoi_dung WHERE ten_dang_nhap = N'test04');
DECLARE @u5 BIGINT = (SELECT ma FROM dbo.nguoi_dung WHERE ten_dang_nhap = N'test05');
DECLARE @u6 BIGINT = (SELECT ma FROM dbo.nguoi_dung WHERE ten_dang_nhap = N'test06');

INSERT dbo.ban_be (ma_nguoi_dung_nho, ma_nguoi_dung_lon, ngay_tao)
SELECT x.ma_nho, x.ma_lon, @now
FROM (VALUES
    (@u1, @u2), (@u1, @u3), (@u1, @u4), (@u2, @u3), (@u5, @u6)
) p(a, b)
CROSS APPLY (SELECT IIF(p.a < p.b, p.a, p.b), IIF(p.a < p.b, p.b, p.a)) x(ma_nho, ma_lon)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ban_be f WHERE f.ma_nguoi_dung_nho = x.ma_nho AND f.ma_nguoi_dung_lon = x.ma_lon);

IF NOT EXISTS (SELECT 1 FROM dbo.phong WHERE ten = N'Room Sample Phase 1' AND ma_nguoi_tao = @u1 AND trang_thai <> 'Closed')
BEGIN
    DECLARE @code CHAR(6);
    WHILE @code IS NULL OR EXISTS (SELECT 1 FROM dbo.phong WHERE ma_so_phong = @code AND trang_thai <> 'Closed')
        SET @code = RIGHT('000000' + CONVERT(VARCHAR(6), ABS(CHECKSUM(NEWID())) % 1000000), 6);

    INSERT dbo.phong (ma_so_phong, token_moi, ten, che_do_hien_thi, trang_thai, so_khan_gia_toi_da, ma_nguoi_tao, ngay_tao)
    VALUES (@code, LOWER(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', '')), N'Room Sample Phase 1', 'Public', 'WaitingOpponent', 10, @u1, @now);

    DECLARE @room BIGINT = SCOPE_IDENTITY();
    INSERT dbo.thanh_vien_phong (ma_phong, ma_nguoi_dung, vai_tro, san_sang, nguon_tham_gia, thoi_diem_vao, thoi_diem_nhan_vai_tro)
    VALUES
        (@room, @u1, 'Host', 0, 'Create', @now, @now),
        (@room, @u2, 'Spectator', 0, 'PublicList', DATEADD(SECOND, 1, @now), DATEADD(SECOND, 1, @now)),
        (@room, @u3, 'Spectator', 0, 'PublicList', DATEADD(SECOND, 2, @now), DATEADD(SECOND, 2, @now));

    IF NOT EXISTS (SELECT 1 FROM dbo.ket_noi_nguoi_dung WHERE ma_nguoi_dung = @u4 AND thoi_diem_ngat_ket_noi IS NULL)
        INSERT dbo.ket_noi_nguoi_dung (ma_nguoi_dung, ma_ket_noi, thoi_diem_ket_noi, lan_thay_cuoi)
        VALUES (@u4, CONCAT('seed-', CONVERT(VARCHAR(36), NEWID())), @now, @now);

    DECLARE @roomInvite BIGINT = NULL;
    IF NOT EXISTS (SELECT 1 FROM dbo.loi_moi_vao_phong WHERE ma_nguoi_moi = @u1 AND trang_thai = 'Pending')
    BEGIN
        INSERT dbo.loi_moi_vao_phong (ma_phong, ma_nguoi_moi, ma_nguoi_duoc_moi, trang_thai, thoi_diem_gui, thoi_diem_het_han)
        VALUES (@room, @u1, @u4, 'Pending', @now, DATEADD(SECOND, 60, @now));
        SET @roomInvite = SCOPE_IDENTITY();
    END;
    IF @roomInvite IS NOT NULL
        INSERT dbo.thong_bao (ma_nguoi_dung, loai, ma_nguoi_thuc_hien, ma_loi_moi_vao_phong, ma_phong, du_lieu_phu, ngay_tao)
        VALUES (@u4, 'RoomInvitationReceived', @u1, @roomInvite, @room, N'{"tenPhong":"Room Sample Phase 1"}', @now);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.loi_moi_ket_ban WHERE ma_nguoi_gui = @u5 AND ma_nguoi_nhan = @u6 AND trang_thai = 'Pending')
BEGIN
    INSERT dbo.loi_moi_ket_ban (ma_nguoi_gui, ma_nguoi_nhan, trang_thai, ngay_tao)
    VALUES (@u5, @u6, 'Pending', @now);
    DECLARE @friendInvite BIGINT = SCOPE_IDENTITY();
    INSERT dbo.thong_bao (ma_nguoi_dung, loai, ma_nguoi_thuc_hien, ma_loi_moi_ket_ban, ngay_tao)
    VALUES (@u6, 'FriendRequestReceived', @u5, @friendInvite, @now);
END;

COMMIT TRANSACTION;
GO
