-- Additive migration. Run after 01_schema_phase1.sql, or after the original schema.
-- No DROP, TRUNCATE, destructive column changes, or seed users.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.nguoi_dung','U') IS NULL OR OBJECT_ID('dbo.tran_dau','U') IS NULL
    THROW 51000, 'Install the base schema before the integration migration.', 1;
IF OBJECT_ID('dbo.integration_account_state','U') IS NULL
CREATE TABLE dbo.integration_account_state (
    singleton bit NOT NULL PRIMARY KEY CHECK(singleton=1),
    payload nvarchar(max) NOT NULL CHECK(ISJSON(payload)=1),
    version bigint NOT NULL DEFAULT 0
);
IF OBJECT_ID('dbo.integration_user_map','U') IS NULL
CREATE TABLE dbo.integration_user_map (
    external_id nvarchar(128) NOT NULL PRIMARY KEY,
    user_id bigint NOT NULL UNIQUE REFERENCES dbo.nguoi_dung(ma)
);
IF OBJECT_ID('dbo.integration_session_map','U') IS NULL
CREATE TABLE dbo.integration_session_map (
    external_id nvarchar(128) NOT NULL PRIMARY KEY,
    session_id bigint NOT NULL UNIQUE REFERENCES dbo.phien_dang_nhap(ma)
);
IF OBJECT_ID('dbo.integration_room_state','U') IS NULL
CREATE TABLE dbo.integration_room_state (
    external_id nvarchar(128) NOT NULL PRIMARY KEY,
    room_id bigint NOT NULL UNIQUE REFERENCES dbo.phong(ma),
    active bit NOT NULL DEFAULT 1,
    payload nvarchar(max) NOT NULL CHECK(ISJSON(payload)=1)
);
IF OBJECT_ID('dbo.integration_match_state','U') IS NULL
CREATE TABLE dbo.integration_match_state (
    external_id nvarchar(128) NOT NULL PRIMARY KEY,
    match_id bigint NOT NULL UNIQUE REFERENCES dbo.tran_dau(ma),
    archived bit NOT NULL DEFAULT 0,
    payload nvarchar(max) NOT NULL CHECK(ISJSON(payload)=1)
);
IF OBJECT_ID('dbo.integration_friend_request_map','U') IS NULL
CREATE TABLE dbo.integration_friend_request_map (
    external_id nvarchar(128) NOT NULL PRIMARY KEY,
    request_id bigint NOT NULL UNIQUE REFERENCES dbo.loi_moi_ket_ban(ma)
);
IF OBJECT_ID('dbo.integration_reset_map','U') IS NULL
CREATE TABLE dbo.integration_reset_map (
    hash nvarchar(128) NOT NULL PRIMARY KEY,
    reset_id bigint NOT NULL UNIQUE REFERENCES dbo.token_dat_lai_mat_khau(ma)
);
COMMIT;
