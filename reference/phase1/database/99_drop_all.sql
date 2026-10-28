/*
   CHI dung de lam sach database test Phase 1.
   Guard co dinh giu script khong the chay nham CoTuongOnline/dev/prod.
   Chay voi: sqlcmd -S <server> -E -C -d CoTuongOnline_Test -i .\database\99_drop_all.sql -b
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'CoTuongOnline_Test'
    THROW 51000, '99_drop_all.sql chi duoc phep chay trong CoTuongOnline_Test.', 1;

BEGIN TRANSACTION;

DECLARE @sql NVARCHAR(MAX);

DECLARE foreign_keys CURSOR LOCAL FAST_FORWARD FOR
    SELECT N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(f.parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(f.parent_object_id))
         + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';'
    FROM sys.foreign_keys f
    WHERE OBJECT_SCHEMA_NAME(f.parent_object_id) = N'dbo';
OPEN foreign_keys;
FETCH NEXT FROM foreign_keys INTO @sql;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM foreign_keys INTO @sql;
END;
CLOSE foreign_keys;
DEALLOCATE foreign_keys;

DECLARE schema_objects CURSOR LOCAL FAST_FORWARD FOR
    SELECT N'DROP VIEW ' + QUOTENAME(OBJECT_SCHEMA_NAME(object_id)) + N'.' + QUOTENAME(name) + N';'
    FROM sys.views WHERE schema_id = SCHEMA_ID(N'dbo')
    UNION ALL
    SELECT N'DROP PROCEDURE ' + QUOTENAME(OBJECT_SCHEMA_NAME(object_id)) + N'.' + QUOTENAME(name) + N';'
    FROM sys.procedures WHERE schema_id = SCHEMA_ID(N'dbo')
    UNION ALL
    SELECT N'DROP FUNCTION ' + QUOTENAME(OBJECT_SCHEMA_NAME(object_id)) + N'.' + QUOTENAME(name) + N';'
    FROM sys.objects WHERE schema_id = SCHEMA_ID(N'dbo') AND type IN ('FN','IF','TF','FS','FT');
OPEN schema_objects;
FETCH NEXT FROM schema_objects INTO @sql;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM schema_objects INTO @sql;
END;
CLOSE schema_objects;
DEALLOCATE schema_objects;

DECLARE dbo_tables CURSOR LOCAL FAST_FORWARD FOR
    SELECT N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
    FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo');
OPEN dbo_tables;
FETCH NEXT FROM dbo_tables INTO @sql;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM dbo_tables INTO @sql;
END;
CLOSE dbo_tables;
DEALLOCATE dbo_tables;

COMMIT TRANSACTION;
GO
