/* =====================================================================
   CO SO DU LIEU HE THONG CO TUONG TRUC TUYEN  (SQL Server / T-SQL)

   Da loai : Elo, bang xep hang, quan tri vien/khoa tai khoan,
             nhieu muc do kho khi choi voi may.
   Nguon   : Kich ban chuc nang (Phase 1-4) + Jira (VIVY-3 ... VIVY-279)

   Quy uoc : - Thoi gian luu UTC, kieu datetime2(3).
             - Khoa chinh BIGINT IDENTITY.
             - Cap (low,high) dung de 1 quan he ban be = 1 dong duy nhat.
             - Cac rang buoc du lieu don gian duoc bao ve bang CHECK/FK/UNIQUE.
             - Luong co tranh chap phai duoc xu ly bang transaction/locking;
               schema va unique index khong thay the logic Backend.

   LUU Y : Day la script TAO MOI database, khong phai migration de chay
           tren database da co bang. Dung migration rieng khi cap nhat moi truong.

   KY HIEU GHI CHU :
     [DB]             Database Developer sua/bao dam truc tiep.
     [BACKEND]        Backend Developer phai trien khai logic ung dung.
     [DB + BACKEND]   Can thong nhat ca schema va cach goi/transaction.
   ===================================================================== */

-- CREATE DATABASE CoTuongOnline COLLATE Vietnamese_100_CI_AS;
-- GO
-- USE CoTuongOnline;
-- GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;   -- bat buoc cho filtered index & computed column
GO

/* =====================================================================
   1. TAI KHOAN, PHIEN, QUEN MAT KHAU, HO SO, CAI DAT
      (Epic VIVY-3, VIVY-9, VIVY-61)
   ===================================================================== */

CREATE TABLE dbo.nguoi_dung (
    ma                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_nguoi_dung PRIMARY KEY,
    ten_dang_nhap             NVARCHAR(50)  NOT NULL,           -- ten dang nhap, duy nhat
    ten_hien_thi         NVARCHAR(50)  NOT NULL,           -- ten hien thi
    email                NVARCHAR(254) NOT NULL,           -- duy nhat, dung de reset mat khau
    mat_khau_bam        NVARCHAR(255) NOT NULL,           -- chi luu hash, khong luu mat khau
    anh_dai_dien           NVARCHAR(500) NULL,
    dang_hoat_dong            BIT           NOT NULL CONSTRAINT DF_nguoi_dung_la_hoat_dong DEFAULT 1,
    ngay_tao           DATETIME2(3)  NOT NULL CONSTRAINT DF_nguoi_dung_tao_luc DEFAULT SYSUTCDATETIME(),
    ngay_cap_nhat           DATETIME2(3)  NOT NULL CONSTRAINT DF_nguoi_dung_cap_nhat_luc DEFAULT SYSUTCDATETIME(), -- [DB] trigger o cuoi script tu cap nhat khi UPDATE
    thoi_diem_doi_mat_khau  DATETIME2(3)  NULL,
    lan_dang_nhap_cuoi        DATETIME2(3)  NULL,
    -- [DB] Chan gia tri rong/toan khoang trang o tang du lieu. Backend van can trim/validate input.
    CONSTRAINT CK_nguoi_dung_ten_dang_nhap CHECK (LEN(LTRIM(RTRIM(ten_dang_nhap))) > 0),
    CONSTRAINT CK_nguoi_dung_ten_hien_thi CHECK (LEN(LTRIM(RTRIM(ten_hien_thi))) > 0),
    CONSTRAINT CK_nguoi_dung_email CHECK (LEN(LTRIM(RTRIM(email))) > 0)
);
GO
CREATE UNIQUE INDEX UX_nguoi_dung_ten_dang_nhap ON dbo.nguoi_dung(ten_dang_nhap);
CREATE UNIQUE INDEX UX_nguoi_dung_email    ON dbo.nguoi_dung(email);
CREATE INDEX IX_nguoi_dung_hien_thi_ten    ON dbo.nguoi_dung(ten_hien_thi);   -- tim nguoi choi
GO

-- Phien dang nhap (refresh token). Dang xuat = set thoi_diem_thu_hoi.
CREATE TABLE dbo.phien_dang_nhap (
    ma                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_phien_dang_nhap PRIMARY KEY,
    ma_nguoi_dung             BIGINT        NOT NULL CONSTRAINT FK_nguoi_dung_phien_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    refresh_token_bam  NVARCHAR(128) NOT NULL,
    trinh_duyet          NVARCHAR(500) NULL,
    dia_chi_ip          VARCHAR(45)   NULL,
    ngay_tao          DATETIME2(3)  NOT NULL CONSTRAINT DF_nguoi_dung_phien_tao DEFAULT SYSUTCDATETIME(),
    lan_dung_cuoi        DATETIME2(3)  NULL,
    thoi_diem_het_han          DATETIME2(3)  NOT NULL,
    thoi_diem_thu_hoi          DATETIME2(3)  NULL,
    CONSTRAINT CK_phien_dang_nhap_han CHECK (thoi_diem_het_han > ngay_tao)
);
GO
CREATE UNIQUE INDEX UX_nguoi_dung_phien_token ON dbo.phien_dang_nhap(refresh_token_bam);
CREATE INDEX IX_nguoi_dung_phien_nguoi_dung ON dbo.phien_dang_nhap(ma_nguoi_dung, thoi_diem_thu_hoi, thoi_diem_het_han);
GO

-- Token dat lai mat khau (VIVY-231). Chi luu hash cua token.
CREATE TABLE dbo.token_dat_lai_mat_khau (
    ma            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_token_dat_lai_mat_khau PRIMARY KEY,
    ma_nguoi_dung       BIGINT       NOT NULL CONSTRAINT FK_token_dat_lai_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    token_bam    NVARCHAR(128) NOT NULL,
    trang_thai        VARCHAR(10)  NOT NULL CONSTRAINT DF_token_dat_lai_trang_thai DEFAULT 'Active',
    ngay_tao    DATETIME2(3) NOT NULL CONSTRAINT DF_token_dat_lai_tao DEFAULT SYSUTCDATETIME(),
    thoi_diem_het_han    DATETIME2(3) NOT NULL,                  -- vi du ngay_tao + 15 phut
    thoi_diem_su_dung       DATETIME2(3) NULL,
    thoi_diem_thu_hoi    DATETIME2(3) NULL,                      -- bi vo hieu do co yeu cau moi hon
    ip_yeu_cau    VARCHAR(45)  NULL,
    CONSTRAINT CK_token_dat_lai_trang_thai CHECK (trang_thai IN ('Active','Used','Expired','Revoked')),
    CONSTRAINT CK_token_dat_lai_han CHECK (thoi_diem_het_han > ngay_tao)
);
-- [DB + BACKEND] UNIQUE Active chi an toan khi Backend chuyen token het han/cu sang Expired/Revoked
-- truoc khi tao token moi. SQL CHECK/index khong the tu dong doi trang thai theo dong ho hien tai.
GO
CREATE UNIQUE INDEX UX_token_dat_lai_token_bam ON dbo.token_dat_lai_mat_khau(token_bam);
-- Moi tai khoan chi co 1 token con hieu luc tai mot thoi diem
CREATE UNIQUE INDEX UX_token_dat_lai_mot_hoat_dong_moi_nguoi_dung
    ON dbo.token_dat_lai_mat_khau(ma_nguoi_dung) WHERE trang_thai = 'Active';
GO

-- Nhat ky yeu cau "Quen mat khau" de gioi han tan suat gui email
-- (ghi ca khi email khong ton tai de khong lo thong tin tai khoan)
CREATE TABLE dbo.yeu_cau_dat_lai_mat_khau (
    ma               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_yeu_cau_dat_lai_mat_khau PRIMARY KEY,
    email            NVARCHAR(254) NOT NULL,
    ma_nguoi_dung          BIGINT        NULL CONSTRAINT FK_yc_dat_lai_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    ip_yeu_cau       VARCHAR(45)   NULL,
    thoi_diem_yeu_cau     DATETIME2(3)  NOT NULL CONSTRAINT DF_yc_dat_lai_yeu_cau DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_yc_dat_lai_email_thoi_gian ON dbo.yeu_cau_dat_lai_mat_khau(email, thoi_diem_yeu_cau);
CREATE INDEX IX_yc_dat_lai_ip_thoi_gian    ON dbo.yeu_cau_dat_lai_mat_khau(ip_yeu_cau, thoi_diem_yeu_cau);
GO

-- Giao dien ban co (VIVY-62)
CREATE TABLE dbo.giao_dien_ban_co (
    ma           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_giao_dien_ban_co PRIMARY KEY,
    ma_dinh_danh         VARCHAR(30)   NOT NULL,
    ten         NVARCHAR(60)  NOT NULL,
    anh_xem_truoc  NVARCHAR(500) NULL,
    dang_hoat_dong    BIT           NOT NULL CONSTRAINT DF_ban_co_giao_dien_hoat_dong DEFAULT 1,
    thu_tu_sap_xep   INT           NOT NULL CONSTRAINT DF_ban_co_giao_dien_sap_xep DEFAULT 0
);
GO
CREATE UNIQUE INDEX UX_ban_co_giao_dien_ma ON dbo.giao_dien_ban_co(ma_dinh_danh);
GO

-- Cai dat ca nhan: giao dien ban co + am thanh (VIVY-62, VIVY-63)
CREATE TABLE dbo.cai_dat_nguoi_dung (
    ma_nguoi_dung         BIGINT       NOT NULL CONSTRAINT PK_cai_dat_nguoi_dung PRIMARY KEY
                                  CONSTRAINT FK_nguoi_dung_cai_dat_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    ma_giao_dien_ban_co  INT          NULL CONSTRAINT FK_nguoi_dung_cai_dat_giao_dien REFERENCES dbo.giao_dien_ban_co(ma),  -- NULL = mac dinh
    bat_am_thanh   BIT          NOT NULL CONSTRAINT DF_nguoi_dung_cai_dat_am_thanh DEFAULT 1,
    ngay_cap_nhat      DATETIME2(3) NOT NULL CONSTRAINT DF_nguoi_dung_cai_dat_cap_nhat DEFAULT SYSUTCDATETIME() -- [DB] trigger o cuoi script tu cap nhat khi UPDATE
);
GO

/* =====================================================================
   2. KET NOI REAL-TIME / TRANG THAI ONLINE  (SignalR)
      Online = con it nhat 1 ket noi chua ngat (ho tro nhieu tab)
   ===================================================================== */

CREATE TABLE dbo.ket_noi_nguoi_dung (
    ma               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ket_noi_nguoi_dung PRIMARY KEY,
    ma_nguoi_dung          BIGINT        NOT NULL CONSTRAINT FK_ket_noi_nd_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    ma_ket_noi    NVARCHAR(100) NOT NULL,               -- SignalR ConnectionId
    thoi_diem_ket_noi     DATETIME2(3)  NOT NULL CONSTRAINT DF_ket_noi_nd_ket_noi DEFAULT SYSUTCDATETIME(),
    lan_thay_cuoi     DATETIME2(3)  NOT NULL CONSTRAINT DF_ket_noi_nd_thay DEFAULT SYSUTCDATETIME(),
    thoi_diem_ngat_ket_noi  DATETIME2(3)  NULL
);
GO
CREATE UNIQUE INDEX UX_ket_noi_nd_ket_noi_ma ON dbo.ket_noi_nguoi_dung(ma_ket_noi);
CREATE INDEX IX_ket_noi_nd_nguoi_dung_hoat_dong ON dbo.ket_noi_nguoi_dung(ma_nguoi_dung) WHERE thoi_diem_ngat_ket_noi IS NULL;
CREATE INDEX IX_ket_noi_nd_heartbeat ON dbo.ket_noi_nguoi_dung(lan_thay_cuoi, ma_nguoi_dung) WHERE thoi_diem_ngat_ket_noi IS NULL;
GO
-- [BACKEND] SignalR/heartbeat phai cap nhat lan_thay_cuoi theo chu ky nho hon lease; khi dong ket noi thi set thoi_diem_ngat_ket_noi.
-- View nay chi doc du lieu; no khong tu dong ghi ngat ket noi hay chay job don dep cac session cu.

/* =====================================================================
   3. BAN BE  (Epic VIVY-48)
   ===================================================================== */

CREATE TABLE dbo.loi_moi_ket_ban (
    ma             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_loi_moi_ket_ban PRIMARY KEY,
    ma_nguoi_gui      BIGINT       NOT NULL CONSTRAINT FK_loi_moi_kb_nguoi_gui   REFERENCES dbo.nguoi_dung(ma),
    ma_nguoi_nhan    BIGINT       NOT NULL CONSTRAINT FK_loi_moi_kb_nguoi_nhan REFERENCES dbo.nguoi_dung(ma),
    trang_thai         VARCHAR(10)  NOT NULL CONSTRAINT DF_loi_moi_kb_trang_thai DEFAULT 'Pending',
    ngay_tao     DATETIME2(3) NOT NULL CONSTRAINT DF_loi_moi_kb_tao DEFAULT SYSUTCDATETIME(),
    thoi_diem_phan_hoi   DATETIME2(3) NULL,
    -- cap khong phan biet chieu A->B / B->A
    ma_nguoi_dung_nho    AS (CASE WHEN ma_nguoi_gui < ma_nguoi_nhan THEN ma_nguoi_gui ELSE ma_nguoi_nhan END) PERSISTED,
    ma_nguoi_dung_lon   AS (CASE WHEN ma_nguoi_gui < ma_nguoi_nhan THEN ma_nguoi_nhan ELSE ma_nguoi_gui END) PERSISTED,
    CONSTRAINT CK_loi_moi_kb_khong_ban_than CHECK (ma_nguoi_gui <> ma_nguoi_nhan),
    CONSTRAINT CK_loi_moi_kb_trang_thai   CHECK (trang_thai IN ('Pending','Accepted','Rejected','Cancelled'))
);
GO
-- Giua 2 nguoi chi ton tai toi da 1 loi moi dang cho (ke ca hai nguoi gui cung luc)
CREATE UNIQUE INDEX UX_loi_moi_kb_mot_dang_cho_moi_cap
    ON dbo.loi_moi_ket_ban(ma_nguoi_dung_nho, ma_nguoi_dung_lon) WHERE trang_thai = 'Pending';
CREATE INDEX IX_loi_moi_kb_nguoi_nhan_dang_cho ON dbo.loi_moi_ket_ban(ma_nguoi_nhan, trang_thai);
CREATE INDEX IX_loi_moi_kb_nguoi_gui_dang_cho   ON dbo.loi_moi_ket_ban(ma_nguoi_gui, trang_thai);
GO

-- Mot quan he ban be = 1 dong (low < high) nen huy ket ban xoa nhat quan ca 2 phia
CREATE TABLE dbo.ban_be (
    ma_nguoi_dung_nho        BIGINT       NOT NULL CONSTRAINT FK_ban_be_nho  REFERENCES dbo.nguoi_dung(ma),
    ma_nguoi_dung_lon       BIGINT       NOT NULL CONSTRAINT FK_ban_be_lon REFERENCES dbo.nguoi_dung(ma),
    ngay_tao         DATETIME2(3) NOT NULL CONSTRAINT DF_ban_be_tao DEFAULT SYSUTCDATETIME(),
    ma_loi_moi_nguon  BIGINT       NULL CONSTRAINT FK_ban_be_yeu_cau REFERENCES dbo.loi_moi_ket_ban(ma),
    CONSTRAINT PK_ban_be PRIMARY KEY (ma_nguoi_dung_nho, ma_nguoi_dung_lon),
    CONSTRAINT CK_ban_be_thu_tu CHECK (ma_nguoi_dung_nho < ma_nguoi_dung_lon)
);
GO
CREATE INDEX IX_ban_be_lon ON dbo.ban_be(ma_nguoi_dung_lon, ma_nguoi_dung_nho);
GO

/* =====================================================================
   4. ROOM, THANH VIEN, CHAN, LOI MOI  (Epic VIVY-4)
   ===================================================================== */

CREATE TABLE dbo.phong (
    ma                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_phong PRIMARY KEY,
    ma_so_phong           CHAR(6)       NOT NULL,           -- ma 6 chu so
    token_moi        CHAR(32)      NOT NULL,           -- token trong duong link moi (kho doan)
    ten                NVARCHAR(100) NOT NULL,
    che_do_hien_thi          VARCHAR(7)    NOT NULL,           -- Public | Private
    trang_thai              VARCHAR(16)   NOT NULL CONSTRAINT DF_phong_trang_thai DEFAULT 'WaitingOpponent',
    so_khan_gia_toi_da      TINYINT       NOT NULL CONSTRAINT DF_phong_khan_gia_toi_da DEFAULT 10,
    ma_nguoi_tao  BIGINT        NOT NULL CONSTRAINT FK_phong_nguoi_tao REFERENCES dbo.nguoi_dung(ma),
    ngay_tao          DATETIME2(3)  NOT NULL CONSTRAINT DF_phong_tao DEFAULT SYSUTCDATETIME(),
    ngay_cap_nhat          DATETIME2(3)  NOT NULL CONSTRAINT DF_phong_cap_nhat DEFAULT SYSUTCDATETIME(), -- [DB] trigger o cuoi script tu cap nhat khi UPDATE
    thoi_diem_dong           DATETIME2(3)  NULL,
    CONSTRAINT CK_phong_ma       CHECK (ma_so_phong LIKE '[0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_phong_hien_thi CHECK (che_do_hien_thi IN ('Public','Private')),
    -- WaitingOpponent: dang cho Doi thu | Full: da du hai nguoi | InMatch: dang dien ra
    -- WaitingNewMatch: dang cho tran moi | Closed: da dong
    CONSTRAINT CK_phong_trang_thai     CHECK (trang_thai IN ('WaitingOpponent','Full','InMatch','WaitingNewMatch','Closed')),
    -- [DB] Kich ban quy dinh toi da 10 khan gia; cho phep dat thap hon, ke ca 0.
    CONSTRAINT CK_phong_so_khan_gia_toi_da CHECK (so_khan_gia_toi_da BETWEEN 0 AND 10),
    CONSTRAINT CK_phong_dong     CHECK ((trang_thai = 'Closed' AND thoi_diem_dong IS NOT NULL)
                                       OR (trang_thai <> 'Closed' AND thoi_diem_dong IS NULL))
);
GO
-- Ma Room khong duoc trung voi Room dang hoat dong; Room dong thi ma duoc tai su dung
CREATE UNIQUE INDEX UX_phong_ma_hoat_dong  ON dbo.phong(ma_so_phong)    WHERE trang_thai <> 'Closed';
CREATE UNIQUE INDEX UX_phong_moi_token ON dbo.phong(token_moi);
CREATE INDEX IX_phong_cong_khai_danh_sach ON dbo.phong(che_do_hien_thi, trang_thai, ngay_tao DESC);
GO
-- [BACKEND] Phai kiem soat cac chuyen trang thai WaitingOpponent/Full/InMatch/WaitingNewMatch/Closed theo dung luong nghiep vu.
-- CHECK chi chan gia tri trang_thai ngoai danh sach; khong chan duoc chuyen tu trang thai cu sang trang thai sai.

-- Thanh vien hien tai/qua khu cua Room. Moi lan vao = 1 dong, roi/bi da = set thoi_diem_roi.
CREATE TABLE dbo.thanh_vien_phong (
    ma                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_thanh_vien_phong PRIMARY KEY,  -- tang dan theo thoi diem vao
    ma_phong           BIGINT       NOT NULL CONSTRAINT FK_tv_phong_phong REFERENCES dbo.phong(ma),
    ma_nguoi_dung           BIGINT       NOT NULL CONSTRAINT FK_tv_phong_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    vai_tro              VARCHAR(9)   NOT NULL,              -- Host | Opponent | Spectator
    san_sang          BIT          NOT NULL CONSTRAINT DF_tv_phong_san_sang DEFAULT 0,
    thoi_diem_san_sang          DATETIME2(3) NULL,
    thoi_diem_vao         DATETIME2(3) NOT NULL CONSTRAINT DF_tv_phong_vao DEFAULT SYSUTCDATETIME(),
    thoi_diem_nhan_vai_tro  DATETIME2(3) NOT NULL CONSTRAINT DF_tv_phong_vai_tro_luc DEFAULT SYSUTCDATETIME(), -- luc giu vai tro hien tai
    nguon_tham_gia       VARCHAR(10)  NULL,                  -- Create | PublicList | Code | Link | Invite
    thoi_diem_roi           DATETIME2(3) NULL,
    ly_do_roi       VARCHAR(12)  NULL,                  -- Left | Kicked | RoomClosed | Disconnected
    CONSTRAINT CK_tv_phong_vai_tro   CHECK (vai_tro IN ('Host','Opponent','Spectator')),
    CONSTRAINT CK_tv_phong_nguon CHECK (nguon_tham_gia IS NULL OR nguon_tham_gia IN ('Create','PublicList','Code','Link','Invite')),
    CONSTRAINT CK_tv_phong_ly_do CHECK (ly_do_roi IS NULL OR ly_do_roi IN ('Left','Kicked','RoomClosed','Disconnected')),
    CONSTRAINT CK_tv_phong_roi   CHECK ((thoi_diem_roi IS NULL AND ly_do_roi IS NULL)
                                OR (thoi_diem_roi IS NOT NULL AND ly_do_roi IS NOT NULL)),
    CONSTRAINT CK_tv_phong_san_sang_khan_gia CHECK (NOT (vai_tro = 'Spectator' AND san_sang = 1))
);
GO
-- Mot nguoi chi xuat hien 1 lan trong cung Room khi dang o trong Room
CREATE UNIQUE INDEX UX_tv_phong_hoat_dong_thanh_vien ON dbo.thanh_vien_phong(ma_phong, ma_nguoi_dung) WHERE thoi_diem_roi IS NULL;
-- Moi Room toi da 1 Chu Room va 1 Doi thu dang hien dien
CREATE UNIQUE INDEX UX_tv_phong_mot_chu_phong     ON dbo.thanh_vien_phong(ma_phong) WHERE vai_tro = 'Host'     AND thoi_diem_roi IS NULL;
CREATE UNIQUE INDEX UX_tv_phong_mot_doi_thu ON dbo.thanh_vien_phong(ma_phong) WHERE vai_tro = 'Opponent' AND thoi_diem_roi IS NULL;
CREATE INDEX IX_tv_phong_nguoi_dung_hoat_dong ON dbo.thanh_vien_phong(ma_nguoi_dung) WHERE thoi_diem_roi IS NULL;
CREATE INDEX IX_tv_phong_phong_khan_gia ON dbo.thanh_vien_phong(ma_phong, thoi_diem_vao) WHERE vai_tro = 'Spectator' AND thoi_diem_roi IS NULL;
GO
-- [DB + BACKEND] Index chi gioi han Host/Opponent va mot thanh vien/Room; khong the CHECK COUNT(*) <= so_khan_gia_toi_da.
-- Backend phai dem khan gia + them thanh vien trong cung transaction, khoa/update Room de tranh vuot gioi han.
-- Moi lan doi vai tro, chuyen Host, kick/roi Room, cap nhat thanh_vien_phong + su_kien_thanh_vien_phong
-- trong cung transaction; unique index se la lop bao ve cuoi cung cho Host/Opponent.

-- Nhat ky su kien thanh vien: vao/roi/da/doi vai tro/chuyen Chu Room (phuc vu debug & kiem thu)
CREATE TABLE dbo.su_kien_thanh_vien_phong (
    ma             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_su_kien_thanh_vien_phong PRIMARY KEY,
    ma_phong        BIGINT       NOT NULL CONSTRAINT FK_sk_tv_phong_phong REFERENCES dbo.phong(ma),
    ma_nguoi_dung        BIGINT       NOT NULL CONSTRAINT FK_sk_tv_phong_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    ma_nguoi_thuc_hien  BIGINT       NULL CONSTRAINT FK_sk_tv_phong_nguoi_thuc_hien REFERENCES dbo.nguoi_dung(ma),  -- nguoi thuc hien (vd: Host da)
    loai_su_kien     VARCHAR(20)  NOT NULL,
    vai_tro_cu      VARCHAR(9)   NULL,
    vai_tro_moi        VARCHAR(9)   NULL,
    ngay_tao     DATETIME2(3) NOT NULL CONSTRAINT DF_sk_tv_phong_tao DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_sk_tv_phong_loai CHECK (loai_su_kien IN
        ('Joined','Left','Kicked','BecameOpponent','RemovedFromOpponent',
         'HostTransferred','ReadyChanged','RoomCreated','RoomClosed')),
    CONSTRAINT CK_sk_tv_phong_tu CHECK (vai_tro_cu IS NULL OR vai_tro_cu IN ('Host','Opponent','Spectator')),
    CONSTRAINT CK_sk_tv_phong_den   CHECK (vai_tro_moi   IS NULL OR vai_tro_moi   IN ('Host','Opponent','Spectator'))
);
GO
CREATE INDEX IX_sk_tv_phong_phong_thoi_gian ON dbo.su_kien_thanh_vien_phong(ma_phong, ngay_tao);
GO

-- Danh sach bi da khoi Room (khong duoc vao lai khi Room con ton tai)
CREATE TABLE dbo.cam_vao_phong (
    ma               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cam_vao_phong PRIMARY KEY,
    ma_phong          BIGINT       NOT NULL CONSTRAINT FK_cam_phong_phong   REFERENCES dbo.phong(ma),
    ma_nguoi_dung          BIGINT       NOT NULL CONSTRAINT FK_cam_phong_nguoi_dung   REFERENCES dbo.nguoi_dung(ma),
    ma_nguoi_cam BIGINT      NOT NULL CONSTRAINT FK_cam_phong_boi     REFERENCES dbo.nguoi_dung(ma),
    thoi_diem_bi_cam        DATETIME2(3) NOT NULL CONSTRAINT DF_cam_phong_luc DEFAULT SYSUTCDATETIME()
);
GO
CREATE UNIQUE INDEX UX_cam_phong_phong_nguoi_dung ON dbo.cam_vao_phong(ma_phong, ma_nguoi_dung);
GO

-- Loi moi truc tiep ban be dang Online vao Room, hieu luc 60 giay
CREATE TABLE dbo.loi_moi_vao_phong (
    ma             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_loi_moi_vao_phong PRIMARY KEY,
    ma_phong        BIGINT       NOT NULL CONSTRAINT FK_loi_moi_phong_phong    REFERENCES dbo.phong(ma),
    ma_nguoi_moi     BIGINT       NOT NULL CONSTRAINT FK_loi_moi_phong_nguoi_moi REFERENCES dbo.nguoi_dung(ma),
    ma_nguoi_duoc_moi     BIGINT       NOT NULL CONSTRAINT FK_loi_moi_phong_nguoi_duoc_moi REFERENCES dbo.nguoi_dung(ma),
    trang_thai         VARCHAR(11)  NOT NULL CONSTRAINT DF_loi_moi_phong_trang_thai DEFAULT 'Pending',
    thoi_diem_gui        DATETIME2(3) NOT NULL CONSTRAINT DF_loi_moi_phong_gui DEFAULT SYSUTCDATETIME(),
    thoi_diem_het_han     DATETIME2(3) NOT NULL,                 -- thoi_diem_gui + 60 giay (Backend set)
    thoi_diem_phan_hoi   DATETIME2(3) NULL,
    CONSTRAINT CK_loi_moi_phong_khong_ban_than CHECK (ma_nguoi_moi <> ma_nguoi_duoc_moi),
    -- Completed: nguoi duoc moi da tham gia | Invalidated: Room dong / doi Host / bi chan
    CONSTRAINT CK_loi_moi_phong_trang_thai CHECK (trang_thai IN ('Pending','Completed','Declined','Expired','Cancelled','Invalidated')),
    CONSTRAINT CK_loi_moi_phong_han CHECK (thoi_diem_het_han > thoi_diem_gui)
);
-- [DB + BACKEND] Pending khong tu het han chi vi da qua thoi_gian_het_han. Backend phai cap nhat Expired/Invalidated
-- truoc khi tao loi moi tiep theo va kiem tra lai han/trang_thai khi nguoi nhan phan hoi.
GO
-- Mot Chu Room chi co 1 loi moi dang cho phan hoi
-- [DB] Index nay chan mot loi moi Pending theo nguoi moi; loi moi qua han van chi het hieu luc sau khi Backend doi trang_thai.
CREATE UNIQUE INDEX UX_loi_moi_phong_mot_dang_cho_moi_nguoi_moi ON dbo.loi_moi_vao_phong(ma_nguoi_moi) WHERE trang_thai = 'Pending';
CREATE INDEX IX_loi_moi_phong_nguoi_duoc_moi_dang_cho ON dbo.loi_moi_vao_phong(ma_nguoi_duoc_moi, trang_thai, thoi_diem_het_han);
CREATE INDEX IX_loi_moi_phong_phong ON dbo.loi_moi_vao_phong(ma_phong, trang_thai);
GO

/* =====================================================================
   5. MATCH (TRAN DAU) PvP & PvE  (Epic VIVY-12, VIVY-40, VIVY-69)
      Kich ban: moi Match luu rieng, Room co the co nhieu Match.
   ===================================================================== */

CREATE TABLE dbo.tran_dau (
    ma                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tran_dau PRIMARY KEY,
    loai_tran           VARCHAR(3)   NOT NULL,           -- PvP | PvE
    ma_phong              BIGINT       NULL CONSTRAINT FK_tran_dau_phong REFERENCES dbo.phong(ma),   -- NULL voi PvE
    ma_nguoi_tao   BIGINT       NOT NULL CONSTRAINT FK_tran_dau_nguoi_tao REFERENCES dbo.nguoi_dung(ma), -- Host bam Bat dau / nguoi choi voi may

    -- Ben Do/Den (phan ngau nhien mot lan). Ben cua may = NULL
    ma_nguoi_choi_do          BIGINT       NULL CONSTRAINT FK_tran_dau_do   REFERENCES dbo.nguoi_dung(ma),
    ma_nguoi_choi_den        BIGINT       NULL CONSTRAINT FK_tran_dau_den REFERENCES dbo.nguoi_dung(ma),
    ben_cua_may         VARCHAR(5)   NULL,               -- PvE: ben do may dieu khien (Red | Black)

    -- Trang thai tran
    -- Countdown: dem nguoc 3-2-1 | InProgress | PausedReconnect: tam cho ket noi lai | Finished
    trang_thai               VARCHAR(15)  NOT NULL CONSTRAINT DF_tran_dau_trang_thai DEFAULT 'Countdown',

    -- Trang thai hien tai (Auto Save)
    ben_den_luot         VARCHAR(5)   NOT NULL CONSTRAINT DF_tran_dau_den_luot DEFAULT 'Red',  -- Do di truoc
    so_nuoc_di           INT          NOT NULL CONSTRAINT DF_tran_dau_so_nuoc_di DEFAULT 0,
    ben_bi_chieu         VARCHAR(5)   NULL,               -- ben dang bi Chieu (neu co)
    gioi_han_luot_giay  SMALLINT     NOT NULL CONSTRAINT DF_tran_dau_gioi_han DEFAULT 60,
    thoi_diem_bat_dau_luot      DATETIME2(3) NULL,               -- thoi diem dong ho luot hien tai bat dau chay
    thoi_gian_con_lai_ms    INT          NULL,               -- thoi gian con lai khi tam dung / tai luc luu
    phien_ban_trang_thai        INT          NOT NULL CONSTRAINT DF_tran_dau_phien_ban DEFAULT 0,  -- tang moi lan luu (chong ghi de/lap)

    -- Ket qua (chot dung mot lan)
    -- Voided: khong du can cu, khong trao thang/thua (loi he thong, hai ben cung mat ket noi)
    ket_qua               VARCHAR(8)   NULL,               -- RedWin | BlackWin | Draw | Voided
    ly_do_ket_thuc           VARCHAR(20)  NULL,
    ma_nguoi_thang       AS (CASE ket_qua WHEN 'RedWin' THEN ma_nguoi_choi_do
                                         WHEN 'BlackWin' THEN ma_nguoi_choi_den END) PERSISTED,

    -- Moc thoi gian
    ngay_tao           DATETIME2(3) NOT NULL CONSTRAINT DF_tran_dau_tao DEFAULT SYSUTCDATETIME(),
    thoi_diem_bat_dau_dem_nguoc DATETIME2(3) NULL,
    thoi_diem_bat_dau           DATETIME2(3) NULL,               -- luc countdown xong, tran chuyen InProgress
    thoi_diem_nuoc_di_cuoi         DATETIME2(3) NULL,
    thoi_diem_ket_thuc             DATETIME2(3) NULL,

    CONSTRAINT CK_tran_dau_loai   CHECK (loai_tran IN ('PvP','PvE')),
    CONSTRAINT CK_tran_dau_trang_thai CHECK (trang_thai IN ('Countdown','InProgress','PausedReconnect','Finished')),
    CONSTRAINT CK_tran_dau_den_luot    CHECK (ben_den_luot IN ('Red','Black')),
    CONSTRAINT CK_tran_dau_chieu    CHECK (ben_bi_chieu IS NULL OR ben_bi_chieu IN ('Red','Black')),
    CONSTRAINT CK_tran_dau_may CHECK (ben_cua_may IS NULL OR ben_cua_may IN ('Red','Black')),
    CONSTRAINT CK_tran_dau_ket_qua CHECK (ket_qua IS NULL OR ket_qua IN ('RedWin','BlackWin','Draw','Voided')),
    CONSTRAINT CK_tran_dau_ly_do CHECK (ly_do_ket_thuc IS NULL OR ly_do_ket_thuc IN
        ('Checkmate','NoLegalMove','Timeout','LeftMatch','DisconnectTimeout',
         'Surrender','DrawAgreed','SystemError')),
    -- [DB] Rang buoc mien gia tri. Backend van phai cap nhat version co dieu kien.
    CONSTRAINT CK_tran_dau_so_nuoc_di CHECK (so_nuoc_di >= 0),
    CONSTRAINT CK_tran_dau_gioi_han_luot CHECK (gioi_han_luot_giay > 0),
    CONSTRAINT CK_tran_dau_thoi_gian_con_lai CHECK (thoi_gian_con_lai_ms IS NULL OR thoi_gian_con_lai_ms >= 0),
    CONSTRAINT CK_tran_dau_phien_ban CHECK (phien_ban_trang_thai >= 0),
    -- [DB] PvP = hai nguoi that + Room. PvE = mot nguoi that + may, ben may bat buoc va khong co Room.
    -- Luu y SQL CHECK co the chap nhan UNKNOWN; ben_cua_may IS NOT NULL duoc ghi ro de chan NULL o PvE.
    CONSTRAINT CK_tran_dau_nguoi_choi CHECK (
        (loai_tran = 'PvP' AND ma_nguoi_choi_do IS NOT NULL AND ma_nguoi_choi_den IS NOT NULL
                            AND ma_nguoi_choi_do <> ma_nguoi_choi_den AND ben_cua_may IS NULL AND ma_phong IS NOT NULL
                            AND ma_nguoi_tao IN (ma_nguoi_choi_do, ma_nguoi_choi_den))
     OR (loai_tran = 'PvE' AND ma_phong IS NULL AND ben_cua_may IS NOT NULL AND
          ((ben_cua_may = 'Red' AND ma_nguoi_choi_do IS NULL AND ma_nguoi_choi_den IS NOT NULL
                               AND ma_nguoi_tao = ma_nguoi_choi_den)
        OR (ben_cua_may = 'Black' AND ma_nguoi_choi_den IS NULL AND ma_nguoi_choi_do IS NOT NULL
                               AND ma_nguoi_tao = ma_nguoi_choi_do)))),
    -- Tran Finished phai co du ket qua; chua Finished thi chua co ket qua
    CONSTRAINT CK_tran_dau_ket_thuc CHECK (
        (trang_thai = 'Finished' AND ket_qua IS NOT NULL AND ly_do_ket_thuc IS NOT NULL AND thoi_diem_ket_thuc IS NOT NULL)
     OR (trang_thai <> 'Finished' AND ket_qua IS NULL AND ly_do_ket_thuc IS NULL AND thoi_diem_ket_thuc IS NULL))
);
GO
CREATE INDEX IX_tran_dau_phong      ON dbo.tran_dau(ma_phong, ngay_tao DESC);
CREATE INDEX IX_tran_dau_do       ON dbo.tran_dau(ma_nguoi_choi_do,   trang_thai, thoi_diem_ket_thuc DESC);
CREATE INDEX IX_tran_dau_den     ON dbo.tran_dau(ma_nguoi_choi_den, trang_thai, thoi_diem_ket_thuc DESC);
CREATE INDEX IX_tran_dau_hoat_dong    ON dbo.tran_dau(trang_thai) WHERE trang_thai <> 'Finished';
-- [DB] Moi Room chi co toi da mot Match chua Finished. PvE khong bi gioi han vi ma_phong IS NULL.
CREATE UNIQUE INDEX UX_tran_dau_mot_active_room ON dbo.tran_dau(ma_phong)
    WHERE ma_phong IS NOT NULL AND trang_thai <> 'Finished';
GO
-- [DB + BACKEND] Backend phai bat dau Match trong transaction: kiem tra Room, thanh vien/ready, tao Match, khoi tao
-- 32 quan va chuyen trang thai Room. Unique index o tren chan duoc race condition cuoi cung theo ma_phong.
-- Khi mot lenh insert/doi status bi tu choi boi unique index, Backend can rollback va tra loi phu hop.

-- Trang thai ban co hien tai: 32 quan/tran. Vi tri hien tai + vi tri ban dau (de dung lai van khi xem lai)
-- loai_quan: General=Tuong, Advisor=Si, Elephant=Tuong, Horse=Ma, Chariot=Xe, Cannon=Phao, Soldier=Tot
-- Toa do: x_hien_tai 0..8 (cot), y_hien_tai 0..9 (hang)
CREATE TABLE dbo.quan_co_tran_dau (
    ma_tran_dau                BIGINT      NOT NULL CONSTRAINT FK_quan_co_tran REFERENCES dbo.tran_dau(ma) ON DELETE CASCADE,
    so_quan                TINYINT     NOT NULL,         -- 1..32, co dinh trong suot tran
    ben                    VARCHAR(5)  NOT NULL,
    loai_quan              VARCHAR(8)  NOT NULL,
    x_ban_dau                  TINYINT     NOT NULL,
    y_ban_dau                  TINYINT     NOT NULL,
    x_hien_tai                   TINYINT     NULL,             -- NULL khi da bi an
    y_hien_tai                   TINYINT     NULL,
    da_bi_an             BIT         NOT NULL CONSTRAINT DF_quan_co_bi_an DEFAULT 0,
    bi_an_o_nuoc_thu INT         NULL,
    CONSTRAINT PK_quan_co_tran_dau PRIMARY KEY (ma_tran_dau, so_quan),
    CONSTRAINT CK_quan_co_so     CHECK (so_quan BETWEEN 1 AND 32),
    CONSTRAINT CK_quan_co_ben   CHECK (ben IN ('Red','Black')),
    CONSTRAINT CK_quan_co_loai   CHECK (loai_quan IN ('General','Advisor','Elephant','Horse','Chariot','Cannon','Soldier')),
    CONSTRAINT CK_quan_co_ban_dau   CHECK (x_ban_dau BETWEEN 0 AND 8 AND y_ban_dau BETWEEN 0 AND 9),
    -- [DB] Khong de quan con tren ban co co toa do NULL (CHECK khong tu dong chan UNKNOWN).
    CONSTRAINT CK_quan_co_vi_tri CHECK (
        (da_bi_an = 0 AND x_hien_tai IS NOT NULL AND y_hien_tai IS NOT NULL
                     AND x_hien_tai BETWEEN 0 AND 8 AND y_hien_tai BETWEEN 0 AND 9
                     AND bi_an_o_nuoc_thu IS NULL)
     OR (da_bi_an = 1 AND x_hien_tai IS NULL AND y_hien_tai IS NULL AND bi_an_o_nuoc_thu IS NOT NULL)),
    CONSTRAINT CK_quan_co_nuoc_an CHECK (bi_an_o_nuoc_thu IS NULL OR bi_an_o_nuoc_thu > 0)
);
GO
-- Hai quan con song khong duoc chong cung mot o
CREATE UNIQUE INDEX UX_quan_co_o ON dbo.quan_co_tran_dau(ma_tran_dau, x_hien_tai, y_hien_tai) WHERE da_bi_an = 0;
-- [DB] Toa do ban dau cung phai khong trung nhau; index nay khong thay the viec khoi tao du 32 quan dung doi hinh.
CREATE UNIQUE INDEX UX_quan_co_vi_tri_ban_dau ON dbo.quan_co_tran_dau(ma_tran_dau, x_ban_dau, y_ban_dau);
GO

-- Lich su nuoc di theo dung thu tu (phuc vu xem lai, hien thi lich su nuoc di)
CREATE TABLE dbo.nuoc_di_tran_dau (
    ma                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_nuoc_di_tran_dau PRIMARY KEY,
    ma_tran_dau            BIGINT       NOT NULL CONSTRAINT FK_nuoc_di_tran REFERENCES dbo.tran_dau(ma) ON DELETE CASCADE,
    so_thu_tu_nuoc_di         INT          NOT NULL,            -- 1,2,3... theo thu tu trong tran
    ben                VARCHAR(5)   NOT NULL,
    ma_nguoi_di      BIGINT       NULL CONSTRAINT FK_nuoc_di_nguoi_di REFERENCES dbo.nguoi_dung(ma),  -- NULL = may di
    so_quan            TINYINT      NOT NULL,
    tu_x              TINYINT      NOT NULL,
    tu_y              TINYINT      NOT NULL,
    den_x                TINYINT      NOT NULL,
    den_y                TINYINT      NOT NULL,
    so_quan_bi_an   TINYINT      NULL,                -- quan bi an tai nuoc nay (neu co)
    gay_chieu            BIT          NOT NULL CONSTRAINT DF_nuoc_di_chieu DEFAULT 0,  -- nuoc nay gay Chieu
    ky_hieu            NVARCHAR(20) NULL,                -- ky hieu nuoc di (tuy chon)
    thoi_gian_di_ms       INT          NULL,
    ma_nuoc_di_client      UNIQUEIDENTIFIER NULL,            -- chong gui lap cung mot thao tac
    ngay_tao          DATETIME2(3) NOT NULL CONSTRAINT DF_nuoc_di_tao DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_nuoc_di_ben  CHECK (ben IN ('Red','Black')),
    -- [DB] Rang buoc mien gia tri, khong thay the kiem tra luat co tuong trong Backend.
    CONSTRAINT CK_nuoc_di_so_thu_tu CHECK (so_thu_tu_nuoc_di > 0),
    CONSTRAINT CK_nuoc_di_thoi_gian CHECK (thoi_gian_di_ms IS NULL OR thoi_gian_di_ms >= 0),
    CONSTRAINT CK_nuoc_di_so_quan CHECK (so_quan BETWEEN 1 AND 32 AND (so_quan_bi_an IS NULL OR so_quan_bi_an BETWEEN 1 AND 32)),
    CONSTRAINT CK_nuoc_di_khac_o CHECK (tu_x <> den_x OR tu_y <> den_y),
    CONSTRAINT CK_nuoc_di_toa_do CHECK (tu_x BETWEEN 0 AND 8 AND den_x BETWEEN 0 AND 8
                              AND tu_y BETWEEN 0 AND 9 AND den_y BETWEEN 0 AND 9),
    CONSTRAINT FK_nuoc_di_quan    FOREIGN KEY (ma_tran_dau, so_quan)          REFERENCES dbo.quan_co_tran_dau(ma_tran_dau, so_quan),
    CONSTRAINT FK_nuoc_di_bi_an FOREIGN KEY (ma_tran_dau, so_quan_bi_an) REFERENCES dbo.quan_co_tran_dau(ma_tran_dau, so_quan)
);
GO
CREATE UNIQUE INDEX UX_nuoc_di_tran_nuoc_di   ON dbo.nuoc_di_tran_dau(ma_tran_dau, so_thu_tu_nuoc_di);
CREATE UNIQUE INDEX UX_nuoc_di_client_nuoc_di  ON dbo.nuoc_di_tran_dau(ma_tran_dau, ma_nuoc_di_client) WHERE ma_nuoc_di_client IS NOT NULL;
GO
-- [DB + BACKEND] Backend phai cap nhat quan co, lich su nuoc di, so_nuoc_di, ben_den_luot, dong ho va
-- phien_ban_trang_thai trong CUNG transaction. Dung UPDATE co dieu kien WHERE phien_ban_trang_thai = @versionCu;
-- chi tang version khi update thang; neu rowcount = 0 hoac bat ky buoc nao loi thi rollback.
-- ma_nuoc_di_client + unique index chan ghi lich su trung, nhung Backend van phai xu ly retry/idempotency va
-- tra lai ket qua da xu ly cho request trung; khong ap dung lai nuoc di lan thu hai.

-- Yeu cau hoa: tai mot thoi diem chi co 1 yeu cau dang cho
CREATE TABLE dbo.de_nghi_hoa (
    ma                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_de_nghi_hoa PRIMARY KEY,
    ma_tran_dau            BIGINT       NOT NULL CONSTRAINT FK_de_nghi_hoa_tran REFERENCES dbo.tran_dau(ma) ON DELETE CASCADE,
    ma_nguoi_de_nghi  BIGINT       NOT NULL CONSTRAINT FK_de_nghi_hoa_nguoi_dung  REFERENCES dbo.nguoi_dung(ma),
    trang_thai              VARCHAR(9)   NOT NULL CONSTRAINT DF_de_nghi_hoa_trang_thai DEFAULT 'Pending',
    ngay_tao          DATETIME2(3) NOT NULL CONSTRAINT DF_de_nghi_hoa_tao DEFAULT SYSUTCDATETIME(),
    thoi_diem_phan_hoi        DATETIME2(3) NULL,
    -- Expired: tran ket thuc vi ly do khac truoc khi doi thu phan hoi
    CONSTRAINT CK_de_nghi_hoa_trang_thai CHECK (trang_thai IN ('Pending','Accepted','Declined','Expired'))
);
GO
CREATE UNIQUE INDEX UX_de_nghi_hoa_mot_dang_cho ON dbo.de_nghi_hoa(ma_tran_dau) WHERE trang_thai = 'Pending';
GO
-- [DB + BACKEND] Kich ban chi yeu cau loi de nghi hoa het hieu luc neu tran ket thuc vi ly do khac;
-- Backend phai dong/Expired yeu cau cho trong cung transaction khi chot tran. Khong tu them timeout rieng neu chua chot nghiep vu.

-- Theo doi mat ket noi cua tung nguoi choi (cho 60 giay, khong tu suy doan nguoi thang)
CREATE TABLE dbo.mat_ket_noi_tran_dau (
    ma                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_mat_ket_noi_tran_dau PRIMARY KEY,
    ma_tran_dau            BIGINT       NOT NULL CONSTRAINT FK_mat_kn_tran REFERENCES dbo.tran_dau(ma) ON DELETE CASCADE,
    ma_nguoi_dung             BIGINT       NOT NULL CONSTRAINT FK_mat_kn_nguoi_dung  REFERENCES dbo.nguoi_dung(ma),
    thoi_diem_ngat_ket_noi     DATETIME2(3) NOT NULL CONSTRAINT DF_mat_kn_ngat_kn DEFAULT SYSUTCDATETIME(),
    han_ket_noi_lai  DATETIME2(3) NOT NULL,            -- thoi_diem_ngat_ket_noi + 60 giay
    thoi_diem_ket_noi_lai      DATETIME2(3) NULL,
    trang_thai              VARCHAR(11)  NOT NULL CONSTRAINT DF_mat_kn_trang_thai DEFAULT 'Waiting',
    -- Voided: khong du can cu xac dinh (ca hai mat ket noi / loi he thong)
    CONSTRAINT CK_mat_kn_trang_thai CHECK (trang_thai IN ('Waiting','Reconnected','TimedOut','Voided')),
    CONSTRAINT CK_mat_kn_han CHECK (han_ket_noi_lai > thoi_diem_ngat_ket_noi)
);
-- [DB + BACKEND] Tien trinh het 60 giay, dung dong ho, reconnect va chot ket qua la logic Backend/job.
-- Khi timeout, cap nhat mat_ket_noi_tran_dau va tran_dau trong cung transaction; khong duoc chot ket qua hai lan.
GO
CREATE UNIQUE INDEX UX_mat_kn_mot_dang_cho ON dbo.mat_ket_noi_tran_dau(ma_tran_dau, ma_nguoi_dung) WHERE trang_thai = 'Waiting';
CREATE INDEX IX_mat_kn_han ON dbo.mat_ket_noi_tran_dau(han_ket_noi_lai) WHERE trang_thai = 'Waiting';
GO

-- Nhat ky su kien Match (Countdown, Paused, Resumed, Finished...) giup xu ly su kien lap/sai thu tu va debug
CREATE TABLE dbo.su_kien_tran_dau (
    ma             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_su_kien_tran_dau PRIMARY KEY,
    ma_tran_dau       BIGINT       NOT NULL CONSTRAINT FK_sk_tran_tran REFERENCES dbo.tran_dau(ma) ON DELETE CASCADE,
    loai_su_kien     VARCHAR(30)  NOT NULL,                 -- Created, CountdownStarted, Started, Paused, Resumed, Finished...
    ma_nguoi_thuc_hien  BIGINT       NULL CONSTRAINT FK_sk_tran_nguoi_thuc_hien REFERENCES dbo.nguoi_dung(ma),
    chi_tiet         NVARCHAR(MAX) NULL,                    -- JSON tuy y
    ngay_tao     DATETIME2(3) NOT NULL CONSTRAINT DF_sk_tran_tao DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_sk_tran_chi_tiet_json CHECK (chi_tiet IS NULL OR ISJSON(chi_tiet) = 1)
);
GO
CREATE INDEX IX_sk_tran_tran_thoi_gian ON dbo.su_kien_tran_dau(ma_tran_dau, ngay_tao);
GO
-- [BACKEND] Moi lan Countdown/Start/Pause/Resume/Finish phai validate trang thai hien tai va ghi su_kien_tran_dau
-- trong cung transaction voi UPDATE tran_dau; tranh xu ly Finish hai lan va cam nuoc di sau Finished.

/* =====================================================================
   6. CHAT RIENG VA VIDEO CALL  (Epic VIVY-58)
   ===================================================================== */

-- Chat rieng giua Chu Room va Doi thu. Khong co chat Khan gia trong phien ban nay.
-- ma_chu_phong / ma_doi_thu = CAP NGUOI CHOI TAI THOI DIEM GUI.
-- Nguoi chi doc duoc tin co ten minh trong cap => nguoi moi len vai tro khong thay tin cu.
CREATE TABLE dbo.tin_nhan_phong (
    ma                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tin_nhan_phong PRIMARY KEY,
    ma_phong           BIGINT        NOT NULL CONSTRAINT FK_tin_nhan_phong   REFERENCES dbo.phong(ma),
    ma_nguoi_gui_tin    BIGINT        NOT NULL CONSTRAINT FK_tin_nhan_nguoi_gui REFERENCES dbo.nguoi_dung(ma),
    ma_chu_phong      BIGINT        NOT NULL CONSTRAINT FK_tin_nhan_chu_phong   REFERENCES dbo.nguoi_dung(ma),
    ma_doi_thu  BIGINT        NOT NULL CONSTRAINT FK_tin_nhan_doi_thu    REFERENCES dbo.nguoi_dung(ma),
    noi_dung           NVARCHAR(1000) NOT NULL,
    thoi_diem_gui           DATETIME2(3)  NOT NULL CONSTRAINT DF_tin_nhan_gui DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_tin_nhan_noi_dung CHECK (LEN(LTRIM(RTRIM(noi_dung))) > 0),   -- khong luu tin rong/chi khoang trang
    CONSTRAINT CK_tin_nhan_nguoi_gui  CHECK (ma_nguoi_gui_tin IN (ma_chu_phong, ma_doi_thu)),
    CONSTRAINT CK_tin_nhan_cap    CHECK (ma_chu_phong <> ma_doi_thu)
);
GO
CREATE INDEX IX_tin_nhan_phong_thoi_gian ON dbo.tin_nhan_phong(ma_phong, thoi_diem_gui);
GO
-- [BACKEND] Truoc khi INSERT/SELECT chat, kiem tra nguoi dung dang giu vai tro Host/Opponent cua Room tai thoi diem thao tac.
-- Cac CHECK phia tren chi kiem tra tinh hop le cua tung dong; chung khong xac minh quan he thanh vien dang hoat dong.

-- Yeu cau Video Call giua Chu Room va Doi thu (tin hieu WebRTC la du lieu tam, khong luu)
CREATE TABLE dbo.cuoc_goi_video (
    ma             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cuoc_goi_video PRIMARY KEY,
    ma_phong        BIGINT       NOT NULL CONSTRAINT FK_cuoc_goi_phong   REFERENCES dbo.phong(ma),
    ma_nguoi_goi      BIGINT       NOT NULL CONSTRAINT FK_cuoc_goi_nguoi_goi REFERENCES dbo.nguoi_dung(ma),
    ma_nguoi_nhan_cuoc_goi      BIGINT       NOT NULL CONSTRAINT FK_cuoc_goi_nguoi_nhan REFERENCES dbo.nguoi_dung(ma),
    trang_thai         VARCHAR(9)   NOT NULL CONSTRAINT DF_cuoc_goi_trang_thai DEFAULT 'Ringing',
    thoi_diem_yeu_cau   DATETIME2(3) NOT NULL CONSTRAINT DF_cuoc_goi_yeu_cau DEFAULT SYSUTCDATETIME(),
    thoi_diem_het_han     DATETIME2(3) NOT NULL,                 -- thoi_diem_yeu_cau + 60 giay
    thoi_diem_tra_loi    DATETIME2(3) NULL,
    thoi_diem_ket_thuc       DATETIME2(3) NULL,
    ly_do_ket_thuc     VARCHAR(10)  NULL,
    CONSTRAINT CK_cuoc_goi_khong_ban_than CHECK (ma_nguoi_goi <> ma_nguoi_nhan_cuoc_goi),
    CONSTRAINT CK_cuoc_goi_trang_thai CHECK (trang_thai IN ('Ringing','Active','Ended','Declined','Missed','Cancelled')),
    CONSTRAINT CK_cuoc_goi_ly_do CHECK (ly_do_ket_thuc IS NULL OR ly_do_ket_thuc IN
        ('Declined','NoAnswer','LeftCall','RoomClosed','RoleLost','Error','Cancelled')),
    CONSTRAINT CK_cuoc_goi_han CHECK (thoi_diem_het_han > thoi_diem_yeu_cau)
);
-- [DB + BACKEND] Backend/job phai xu ly Ringing qua han -> Missed/Cancelled va ket thuc cuoc goi khi mat quyen/Room dong.
-- Khi chap nhan/ghe cuoc goi, kiem tra lai vai tro va thanh vien Room; unique index chi gioi han 1 call Ringing/Active moi Room.
GO
-- Moi Room toi da 1 Video Call dang goi hoac dang hoat dong
-- [DB + BACKEND] Unique index chan hai call cung phong; Backend phai tranh chap tranh, tu choi request cu va cap nhat trang_thai timeout.
CREATE UNIQUE INDEX UX_cuoc_goi_mot_dang_goi_moi_phong ON dbo.cuoc_goi_video(ma_phong) WHERE trang_thai IN ('Ringing','Active');
CREATE INDEX IX_cuoc_goi_nguoi_nhan ON dbo.cuoc_goi_video(ma_nguoi_nhan_cuoc_goi, trang_thai);
GO

CREATE TABLE dbo.nguoi_tham_gia_cuoc_goi (
    ma_cuoc_goi  BIGINT       NOT NULL CONSTRAINT FK_tg_cuoc_goi_goi REFERENCES dbo.cuoc_goi_video(ma) ON DELETE CASCADE,
    ma_nguoi_dung        BIGINT       NOT NULL CONSTRAINT FK_tg_cuoc_goi_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    thoi_diem_vao      DATETIME2(3) NOT NULL CONSTRAINT DF_tg_cuoc_goi_vao DEFAULT SYSUTCDATETIME(),
    thoi_diem_roi        DATETIME2(3) NULL,
    chi_am_thanh     BIT          NOT NULL CONSTRAINT DF_tg_cuoc_goi_am_thanh DEFAULT 0,   -- khong co camera nhung co micro
    CONSTRAINT PK_nguoi_tham_gia_cuoc_goi PRIMARY KEY (ma_cuoc_goi, ma_nguoi_dung)
);
GO

/* =====================================================================
   7. THONG BAO TRONG GAME  (VIVY-60; thong bao ket ban / moi phong)
   ===================================================================== */

CREATE TABLE dbo.thong_bao (
    ma                    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_thong_bao PRIMARY KEY,
    ma_nguoi_dung               BIGINT       NOT NULL CONSTRAINT FK_thong_bao_nguoi_dung REFERENCES dbo.nguoi_dung(ma),   -- nguoi nhan
    loai                  VARCHAR(30)  NOT NULL,
    ma_nguoi_thuc_hien         BIGINT       NULL CONSTRAINT FK_thong_bao_nguoi_thuc_hien REFERENCES dbo.nguoi_dung(ma),      -- nguoi gay ra thong bao
    ma_loi_moi_ket_ban     BIGINT       NULL CONSTRAINT FK_thong_bao_loi_moi_kb   REFERENCES dbo.loi_moi_ket_ban(ma),
    ma_loi_moi_vao_phong    BIGINT       NULL CONSTRAINT FK_thong_bao_loi_moi_phong   REFERENCES dbo.loi_moi_vao_phong(ma),
    ma_phong               BIGINT       NULL CONSTRAINT FK_thong_bao_phong REFERENCES dbo.phong(ma),
    du_lieu_phu               NVARCHAR(MAX) NULL,                 -- JSON phu (vd: ten Room tai thoi diem gui)
    da_doc               BIT          NOT NULL CONSTRAINT DF_thong_bao_doc DEFAULT 0,
    ngay_tao            DATETIME2(3) NOT NULL CONSTRAINT DF_thong_bao_tao DEFAULT SYSUTCDATETIME(),
    thoi_diem_doc               DATETIME2(3) NULL,
    CONSTRAINT CK_thong_bao_loai CHECK (loai IN
        ('FriendRequestReceived','FriendRequestAccepted','FriendRequestRejected',
         'RoomInvitationReceived','RoomInvitationDeclined','RoomInvitationCancelled','RoomInvitationExpired')),
    CONSTRAINT CK_thong_bao_du_lieu_phu_json CHECK (du_lieu_phu IS NULL OR ISJSON(du_lieu_phu) = 1)
);
GO
CREATE INDEX IX_thong_bao_nguoi_dung_chua_doc ON dbo.thong_bao(ma_nguoi_dung, da_doc, ngay_tao DESC);
GO

/* =====================================================================
   8. VIEW BAO CAO (chi doc, khong chua luat choi)
   ===================================================================== */

-- Nguoi choi Online neu co it nhat 1 ket noi chua ngat va heartbeat con moi.
-- [DB + BACKEND] Lease 60 giay la gia tri cau hinh khoi dau; can thong nhat voi chu ky heartbeat/reconnect trong Backend.
CREATE VIEW dbo.v_nguoi_dung_online AS
SELECT u.ma AS ma_nguoi_dung, u.ten_dang_nhap, u.ten_hien_thi,
       CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.ket_noi_nguoi_dung c
                               WHERE c.ma_nguoi_dung = u.ma
                                 AND c.thoi_diem_ngat_ket_noi IS NULL
                                 AND c.lan_thay_cuoi >= DATEADD(SECOND, -60, SYSUTCDATETIME()))
                 THEN 1 ELSE 0 END AS BIT) AS dang_online
FROM dbo.nguoi_dung u;
GO

-- Danh sach ban be cua tung nguoi (moi quan he hien ra 2 chieu)
CREATE VIEW dbo.v_danh_sach_ban_be AS
SELECT f.ma_nguoi_dung_nho  AS ma_nguoi_dung, f.ma_nguoi_dung_lon AS ma_ban_be, f.ngay_tao FROM dbo.ban_be f
UNION ALL
SELECT f.ma_nguoi_dung_lon AS ma_nguoi_dung, f.ma_nguoi_dung_nho  AS ma_ban_be, f.ngay_tao FROM dbo.ban_be f;
GO

-- Danh sach Room cong khai: ten Room, Chu Room, trang thai, so Khan gia
CREATE VIEW dbo.v_phong_cong_khai AS
SELECT r.ma AS ma_phong, r.ma_so_phong, r.ten AS ten_phong, r.trang_thai,
       h.ma_nguoi_dung AS ma_chu_phong, hu.ten_hien_thi AS ten_hien_thi_chu_phong,
       (SELECT COUNT(*) FROM dbo.thanh_vien_phong s
         WHERE s.ma_phong = r.ma AND s.vai_tro = 'Spectator' AND s.thoi_diem_roi IS NULL) AS so_khan_gia,
       r.so_khan_gia_toi_da, r.ngay_tao
FROM dbo.phong r
LEFT JOIN dbo.thanh_vien_phong h  ON h.ma_phong = r.ma AND h.vai_tro = 'Host' AND h.thoi_diem_roi IS NULL
LEFT JOIN dbo.nguoi_dung hu        ON hu.ma = h.ma_nguoi_dung
WHERE r.che_do_hien_thi = 'Public' AND r.trang_thai <> 'Closed';
GO

-- Moi tran da xong theo goc nhin tung nguoi choi (Lich su tran dau, VIVY-53/165)
CREATE VIEW dbo.v_lich_su_tran_dau AS
SELECT x.ma_nguoi_dung, x.ma_tran_dau, x.loai_tran, x.ben, x.ma_doi_thu,
       x.ket_qua, x.ly_do_ket_thuc, x.thoi_diem_bat_dau, x.thoi_diem_ket_thuc, x.so_nuoc_di,
       DATEDIFF(SECOND, x.thoi_diem_bat_dau, x.thoi_diem_ket_thuc) AS thoi_luong_giay,
       CASE WHEN x.ket_qua = 'Draw'   THEN 'Draw'
            WHEN x.ket_qua = 'Voided' THEN 'Voided'
            WHEN (x.ben = 'Red'   AND x.ket_qua = 'RedWin')
              OR (x.ben = 'Black' AND x.ket_qua = 'BlackWin') THEN 'Win'
            ELSE 'Loss' END AS ket_qua_ca_nhan
FROM (
    SELECT m.ma_nguoi_choi_do AS ma_nguoi_dung, m.ma AS ma_tran_dau, m.loai_tran, CAST('Red' AS VARCHAR(5)) AS ben,
           m.ma_nguoi_choi_den AS ma_doi_thu, m.ket_qua, m.ly_do_ket_thuc,
           m.thoi_diem_bat_dau, m.thoi_diem_ket_thuc, m.so_nuoc_di
    FROM dbo.tran_dau m WHERE m.trang_thai = 'Finished' AND m.ma_nguoi_choi_do IS NOT NULL
    UNION ALL
    SELECT m.ma_nguoi_choi_den, m.ma, m.loai_tran, 'Black',
           m.ma_nguoi_choi_do, m.ket_qua, m.ly_do_ket_thuc,
           m.thoi_diem_bat_dau, m.thoi_diem_ket_thuc, m.so_nuoc_di
    FROM dbo.tran_dau m WHERE m.trang_thai = 'Finished' AND m.ma_nguoi_choi_den IS NOT NULL
) x;
GO

-- Thong ke ho so: so tran, thang, thua, hoa (khong Elo / xep hang)
CREATE VIEW dbo.v_thong_ke_nguoi_dung AS
SELECT u.ma AS ma_nguoi_dung,
       COUNT(h.ma_tran_dau) AS tong_so_tran,
       SUM(CASE WHEN h.ket_qua_ca_nhan = 'Win'  THEN 1 ELSE 0 END) AS so_tran_thang,
       SUM(CASE WHEN h.ket_qua_ca_nhan = 'Loss' THEN 1 ELSE 0 END) AS so_tran_thua,
       SUM(CASE WHEN h.ket_qua_ca_nhan = 'Draw' THEN 1 ELSE 0 END) AS so_tran_hoa
FROM dbo.nguoi_dung u
LEFT JOIN dbo.v_lich_su_tran_dau h ON h.ma_nguoi_dung = u.ma AND h.ket_qua_ca_nhan <> 'Voided'
GROUP BY u.ma;
GO

/* =====================================================================
   9. DU LIEU KHOI TAO
   ===================================================================== */
INSERT INTO dbo.giao_dien_ban_co (ma_dinh_danh, ten, thu_tu_sap_xep) VALUES
    ('classic', N'Co dien', 1),
    ('wood',    N'Go',      2);
GO

/* =====================================================================
   10. KHOI TAO DOI HINH CO CHUAN
   ===================================================================== */

-- [DB + BACKEND] Backend phai goi procedure nay trong CUNG transaction voi INSERT tran_dau va cap nhat phong.
-- Procedure chi khoi tao duoc Match dang Countdown va chua co quan; neu goi lap se THROW.
-- Quy uoc toa do: Red o y=0 va tien ve y tang dan; Black o y=9 va tien ve y giam dan.
-- Can han che quyen INSERT truc tiep vao dbo.quan_co_tran_dau trong moi truong van hanh de tranh bo qua quy trinh.
CREATE OR ALTER PROCEDURE dbo.usp_khoi_tao_quan_co_tran_dau
    @ma_tran_dau BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 51001, 'Can goi procedure trong transaction tao Match.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.tran_dau WHERE ma = @ma_tran_dau AND trang_thai = 'Countdown')
        THROW 51002, 'Khong tim thay Match Countdown hop le de khoi tao ban co.', 1;

    IF EXISTS (SELECT 1 FROM dbo.quan_co_tran_dau WHERE ma_tran_dau = @ma_tran_dau)
        THROW 51003, 'Match da co du lieu quan co; khong khoi tao lap lai.', 1;

    INSERT INTO dbo.quan_co_tran_dau
        (ma_tran_dau, so_quan, ben, loai_quan, x_ban_dau, y_ban_dau, x_hien_tai, y_hien_tai, da_bi_an, bi_an_o_nuoc_thu)
    VALUES
        (@ma_tran_dau,  1, 'Red',   'Chariot',  0, 0, 0, 0, 0, NULL),
        (@ma_tran_dau,  2, 'Red',   'Horse',    1, 0, 1, 0, 0, NULL),
        (@ma_tran_dau,  3, 'Red',   'Elephant', 2, 0, 2, 0, 0, NULL),
        (@ma_tran_dau,  4, 'Red',   'Advisor',  3, 0, 3, 0, 0, NULL),
        (@ma_tran_dau,  5, 'Red',   'General',  4, 0, 4, 0, 0, NULL),
        (@ma_tran_dau,  6, 'Red',   'Advisor',  5, 0, 5, 0, 0, NULL),
        (@ma_tran_dau,  7, 'Red',   'Elephant', 6, 0, 6, 0, 0, NULL),
        (@ma_tran_dau,  8, 'Red',   'Horse',    7, 0, 7, 0, 0, NULL),
        (@ma_tran_dau,  9, 'Red',   'Chariot',  8, 0, 8, 0, 0, NULL),
        (@ma_tran_dau, 10, 'Red',   'Cannon',   1, 2, 1, 2, 0, NULL),
        (@ma_tran_dau, 11, 'Red',   'Cannon',   7, 2, 7, 2, 0, NULL),
        (@ma_tran_dau, 12, 'Red',   'Soldier',  0, 3, 0, 3, 0, NULL),
        (@ma_tran_dau, 13, 'Red',   'Soldier',  2, 3, 2, 3, 0, NULL),
        (@ma_tran_dau, 14, 'Red',   'Soldier',  4, 3, 4, 3, 0, NULL),
        (@ma_tran_dau, 15, 'Red',   'Soldier',  6, 3, 6, 3, 0, NULL),
        (@ma_tran_dau, 16, 'Red',   'Soldier',  8, 3, 8, 3, 0, NULL),
        (@ma_tran_dau, 17, 'Black', 'Chariot',  0, 9, 0, 9, 0, NULL),
        (@ma_tran_dau, 18, 'Black', 'Horse',    1, 9, 1, 9, 0, NULL),
        (@ma_tran_dau, 19, 'Black', 'Elephant', 2, 9, 2, 9, 0, NULL),
        (@ma_tran_dau, 20, 'Black', 'Advisor',  3, 9, 3, 9, 0, NULL),
        (@ma_tran_dau, 21, 'Black', 'General',  4, 9, 4, 9, 0, NULL),
        (@ma_tran_dau, 22, 'Black', 'Advisor',  5, 9, 5, 9, 0, NULL),
        (@ma_tran_dau, 23, 'Black', 'Elephant', 6, 9, 6, 9, 0, NULL),
        (@ma_tran_dau, 24, 'Black', 'Horse',    7, 9, 7, 9, 0, NULL),
        (@ma_tran_dau, 25, 'Black', 'Chariot',  8, 9, 8, 9, 0, NULL),
        (@ma_tran_dau, 26, 'Black', 'Cannon',   1, 7, 1, 7, 0, NULL),
        (@ma_tran_dau, 27, 'Black', 'Cannon',   7, 7, 7, 7, 0, NULL),
        (@ma_tran_dau, 28, 'Black', 'Soldier',  0, 6, 0, 6, 0, NULL),
        (@ma_tran_dau, 29, 'Black', 'Soldier',  2, 6, 2, 6, 0, NULL),
        (@ma_tran_dau, 30, 'Black', 'Soldier',  4, 6, 4, 6, 0, NULL),
        (@ma_tran_dau, 31, 'Black', 'Soldier',  6, 6, 6, 6, 0, NULL),
        (@ma_tran_dau, 32, 'Black', 'Soldier',  8, 6, 8, 6, 0, NULL);

    IF @@ROWCOUNT <> 32
        THROW 51004, 'Khoi tao doi hinh khong du 32 quan.', 1;
END;
GO
-- [BACKEND] Game engine phai kiem tra luat di quan, chieu/bi, luot, ben di va nuoc hop le.
-- Procedure nay chi tao trang thai ban co ban dau; khong phai bo luat co tuong.

/* =====================================================================
   11. TU DONG CAP NHAT NGAY_CAP_NHAT
   ===================================================================== */

-- [DB] Trigger ap dung cho moi UPDATE, ke ca khi UPDATE duoc phat ra tu Backend.
CREATE OR ALTER TRIGGER dbo.TR_nguoi_dung_ngay_cap_nhat
ON dbo.nguoi_dung
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID('dbo.TR_nguoi_dung_ngay_cap_nhat')) > 1 RETURN;
    UPDATE u SET ngay_cap_nhat = SYSUTCDATETIME()
    FROM dbo.nguoi_dung AS u
    INNER JOIN inserted AS i ON i.ma = u.ma;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_phong_ngay_cap_nhat
ON dbo.phong
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID('dbo.TR_phong_ngay_cap_nhat')) > 1 RETURN;
    UPDATE r SET ngay_cap_nhat = SYSUTCDATETIME()
    FROM dbo.phong AS r
    INNER JOIN inserted AS i ON i.ma = r.ma;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_cai_dat_nguoi_dung_ngay_cap_nhat
ON dbo.cai_dat_nguoi_dung
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID('dbo.TR_cai_dat_nguoi_dung_ngay_cap_nhat')) > 1 RETURN;
    UPDATE s SET ngay_cap_nhat = SYSUTCDATETIME()
    FROM dbo.cai_dat_nguoi_dung AS s
    INNER JOIN inserted AS i ON i.ma_nguoi_dung = s.ma_nguoi_dung;
END;
GO
-- [BACKEND] Khong can tu set ngay_cap_nhat tren ba bang tren; neu Backend doc truong nay, doc gia tri sau UPDATE.

/* =====================================================================
   12. KHOA IDEMPOTENCY (mo rong cho Phase 1)
      README yeu cau: "bam nut nhieu lan lien tiep khong duoc tao ra nhieu
      ban ghi giong nhau" (Dang ky, Tao Room, Bat dau, Kết bạn, ...).
      SQL CHECK/UNIQUE khong lo duoc hanh vi nghiep vu, nen can bang ghi
      rieng luu khoa idempotency do Backend sinh ra.
   ===================================================================== */

CREATE TABLE dbo.yeu_cau_chong_lap (
    ma                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_yeu_cau_chong_lap PRIMARY KEY,
    ma_nguoi_dung             BIGINT        NOT NULL CONSTRAINT FK_yc_cl_nguoi_dung REFERENCES dbo.nguoi_dung(ma),
    khoa_idempotency   NVARCHAR(64) NOT NULL,           -- khoa do client sinh (Guid) cho thao tac nay
    loai_yeu_cau            VARCHAR(30)  NOT NULL,           -- Register | CreateRoom | StartMatch | FriendRequest | ...
    ket_qua_bam           NVARCHAR(MAX) NULL,            -- JSON ket qua tra ve lan dau (de retry tra lai cung ket qua)
    ngay_tao           DATETIME2(3) NOT NULL CONSTRAINT DF_yc_cl_tao DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_yc_cl_loai CHECK (loai_yeu_cau IN
        ('Register','Login','CreateRoom','JoinRoom','StartMatch','Ready',
         'FriendRequest','RoomInvite','SendChat','ResetPassword')),
    CONSTRAINT CK_yc_cl_khoa CHECK (LEN(LTRIM(RTRIM(khoa_idempotency))) > 0)
);
GO
-- [DB + BACKEND] UNIQUE theo (nguoi_dung, loai, khoa) de retry cung mot thao tac khong
-- tao ban ghi moi. Backend insert khoa TRUOC khi thuc hien tac dong; neu insert bi
-- unique violation thi doc ban ghi da ton tai va tra lai ket_qua_bam (khong thuc hien lai).
CREATE UNIQUE INDEX UX_yc_cl_nguoi_loai_khoa ON dbo.yeu_cau_chong_lap(ma_nguoi_dung, loai_yeu_cau, khoa_idempotency);
CREATE INDEX IX_yc_cl_ngay_tao ON dbo.yeu_cau_chong_lap(ngay_tao);
GO
-- [DB] Ban ghi da cu hon 7 ngay co the don dep boi job (khong anh huong hien tai).
