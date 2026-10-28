/*
  Phase 4 runtime bridge for SQL Server.

  TEMPORARY integration layer:
  - Phase 4 currently uses client string playerId values.
  - Official schema uses dbo.nguoi_dung.ma BIGINT.
  - These two tables let Phase 4 stop using rooms.json/matches.json now.
  - After Phase 1 auth is merged, replace the adapter internals with the
    official normalized tables (phong, thanh_vien_phong, tran_dau, ...).
*/

IF OBJECT_ID(N'dbo.phase4_room_state', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.phase4_room_state (
    room_code CHAR(6) NOT NULL CONSTRAINT PK_phase4_room_state PRIMARY KEY,
    state_payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL
      CONSTRAINT DF_phase4_room_state_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_phase4_room_state_json CHECK (ISJSON(state_payload) = 1)
  );
END;
GO

IF OBJECT_ID(N'dbo.phase4_match_state', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.phase4_match_state (
    match_id NVARCHAR(128) NOT NULL CONSTRAINT PK_phase4_match_state PRIMARY KEY,
    state_payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL
      CONSTRAINT DF_phase4_match_state_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_phase4_match_state_json CHECK (ISJSON(state_payload) = 1)
  );
END;
GO
