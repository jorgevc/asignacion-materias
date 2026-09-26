BEGIN TRY

BEGIN TRAN;

-- CreateTable
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'historical_files')
BEGIN
    CREATE TABLE [dbo].[historical_files] (
        [id] INT NOT NULL IDENTITY(1,1),
        [name] NVARCHAR(1000) NOT NULL,
        [sizeBytes] INT NOT NULL CONSTRAINT [historical_files_sizeBytes_df] DEFAULT 0,
        [rowCount] INT NOT NULL CONSTRAINT [historical_files_rowCount_df] DEFAULT 0,
        [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [historical_files_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [historical_files_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [historical_files_name_key] UNIQUE NONCLUSTERED ([name])
    );
END

-- CreateTable
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'historical_records')
BEGIN
    CREATE TABLE [dbo].[historical_records] (
        [id] INT NOT NULL IDENTITY(1,1),
        [fileId] INT NOT NULL,
        [sourceFile] NVARCHAR(1000) NOT NULL,
        [period] INT NOT NULL,
        [year] INT NOT NULL,
        [employeeId] NVARCHAR(1000),
        [teacherName] NVARCHAR(1000),
        [courseCode] NVARCHAR(1000) NOT NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [historical_records_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [historical_records_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [historical_records_fileId_fkey] FOREIGN KEY ([fileId]) REFERENCES [dbo].[historical_files]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
    );

    CREATE NONCLUSTERED INDEX [historical_records_year_courseCode_idx] ON [dbo].[historical_records]([year], [courseCode]);
    CREATE NONCLUSTERED INDEX [historical_records_fileId_idx] ON [dbo].[historical_records]([fileId]);
    CREATE NONCLUSTERED INDEX [historical_records_employeeId_idx] ON [dbo].[historical_records]([employeeId]);
END

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
