-- Stage 2: initial schema. See plan §D for rationale on each table.

CREATE TABLE IF NOT EXISTS Users (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Username TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  Role TEXT NOT NULL CHECK (Role IN ('SuperAdmin', 'Admin')),
  IsActive INTEGER NOT NULL DEFAULT 1,
  MustChangePassword INTEGER NOT NULL DEFAULT 0,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  LastLoginAt TEXT
);

CREATE TABLE IF NOT EXISTS EventSettings (
  SettingName TEXT PRIMARY KEY,
  Value TEXT,
  Description TEXT,
  DataType TEXT NOT NULL DEFAULT 'string' CHECK (DataType IN ('string', 'number', 'boolean', 'path', 'url', 'json')),
  IsRequired INTEGER NOT NULL DEFAULT 0,
  IsSensitive INTEGER NOT NULL DEFAULT 0,
  UpdatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UpdatedBy TEXT
);

CREATE TABLE IF NOT EXISTS LEDDevices (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  DeviceKey TEXT NOT NULL UNIQUE CHECK (DeviceKey IN ('LED1', 'LED2', 'LED3')),
  DisplayLabel TEXT NOT NULL,
  ResolutionWidth INTEGER NOT NULL,
  ResolutionHeight INTEGER NOT NULL,
  TargetPath TEXT,
  Enabled INTEGER NOT NULL DEFAULT 0,
  LastConnectionTestAt TEXT,
  LastConnectionStatus TEXT CHECK (LastConnectionStatus IN ('UNTESTED', 'PASS', 'FAIL')),
  LastConnectionMessage TEXT,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UpdatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS LED_File_Requirements (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Filename TEXT NOT NULL,
  ActionType TEXT,
  Description TEXT,
  CanonicalFilename TEXT NOT NULL UNIQUE,
  RequiredOrOptional TEXT NOT NULL CHECK (RequiredOrOptional IN ('REQUIRED', 'OPTIONAL')),
  FallbackFilename TEXT,
  IsPersistentAsset INTEGER NOT NULL DEFAULT 0,
  ImportBatchId TEXT NOT NULL,
  ImportedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS LED_File_Requirements_Devices (
  RequirementId INTEGER NOT NULL REFERENCES LED_File_Requirements (Id) ON DELETE CASCADE,
  DeviceKey TEXT NOT NULL CHECK (DeviceKey IN ('LED1', 'LED2', 'LED3')),
  PRIMARY KEY (RequirementId, DeviceKey)
);

CREATE TABLE IF NOT EXISTS RunningOrderSponsorAliases (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  EventId TEXT NOT NULL,
  RunningOrderLabel TEXT NOT NULL,
  ResolvedFileStem TEXT,
  MatchMethod TEXT CHECK (MatchMethod IN ('exact', 'prefix', 'manual', 'unresolved')),
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (EventId, RunningOrderLabel)
);

CREATE TABLE IF NOT EXISTS ProcessingRuns (
  RunId TEXT PRIMARY KEY,
  EventId TEXT,
  StartTime TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  EndTime TEXT,
  StartedByUserId INTEGER REFERENCES Users (Id),
  Status TEXT NOT NULL DEFAULT 'IDLE',
  ErrorSummary TEXT
);

CREATE TABLE IF NOT EXISTS ProcessingFiles (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  RunId TEXT NOT NULL REFERENCES ProcessingRuns (RunId) ON DELETE CASCADE,
  SourceRelativePath TEXT NOT NULL,
  SourceFilename TEXT NOT NULL,
  DetectedDeviceToken TEXT,
  AssetCategory TEXT CHECK (AssetCategory IN ('A', 'B', 'UNMATCHED')),
  MeasuredWidth INTEGER,
  MeasuredHeight INTEGER,
  MeasuredFormat TEXT,
  MeasuredBitrateOrSizeBytes INTEGER,
  ContentHash TEXT,
  GraphETag TEXT,
  GraphQuickXorHash TEXT,
  GraphLastModified TEXT,
  FileStatus TEXT CHECK (FileStatus IN ('NEW', 'MODIFIED', 'NO_CHANGE', 'INVALID', 'UNMATCHED')),
  ValidationStatus TEXT CHECK (ValidationStatus IN ('VALID', 'INVALID', 'NOT_APPLICABLE')),
  MatchedRequirementId INTEGER REFERENCES LED_File_Requirements (Id),
  MatchedSponsorAliasId INTEGER REFERENCES RunningOrderSponsorAliases (Id),
  RenamedFilename TEXT,
  LocalDownloadPath TEXT,
  LocalRenamedPath TEXT,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_processingfiles_runid ON ProcessingFiles (RunId);

CREATE TABLE IF NOT EXISTS ValidationResults (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  ProcessingFileId INTEGER NOT NULL REFERENCES ProcessingFiles (Id) ON DELETE CASCADE,
  RuleName TEXT NOT NULL,
  ExpectedValue TEXT,
  ActualValue TEXT,
  Result TEXT NOT NULL CHECK (Result IN ('PASS', 'FAIL')),
  FailureReason TEXT,
  Severity TEXT NOT NULL DEFAULT 'ERROR',
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_validationresults_fileid ON ValidationResults (ProcessingFileId);

CREATE TABLE IF NOT EXISTS RenamedAssets (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  ProcessingFileId INTEGER REFERENCES ProcessingFiles (Id),
  RunId TEXT NOT NULL REFERENCES ProcessingRuns (RunId) ON DELETE CASCADE,
  DeviceKey TEXT NOT NULL,
  CanonicalFilename TEXT NOT NULL,
  SourcePath TEXT,
  RenamedPath TEXT NOT NULL,
  IsFallbackUsed INTEGER NOT NULL DEFAULT 0,
  FallbackReason TEXT,
  ContentHash TEXT,
  VerifiedAt TEXT,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_renamedassets_runid ON RenamedAssets (RunId);

CREATE TABLE IF NOT EXISTS SequenceEntries (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  RunId TEXT NOT NULL REFERENCES ProcessingRuns (RunId) ON DELETE CASCADE,
  DeviceKey TEXT NOT NULL,
  Sequence INTEGER NOT NULL,
  Filename TEXT NOT NULL,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sequenceentries_runid ON SequenceEntries (RunId);

CREATE TABLE IF NOT EXISTS DistributionResults (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  RunId TEXT NOT NULL REFERENCES ProcessingRuns (RunId) ON DELETE CASCADE,
  DeviceKey TEXT NOT NULL,
  Filename TEXT NOT NULL,
  SourcePath TEXT,
  DestinationPath TEXT,
  SizeBytes INTEGER,
  ContentHash TEXT,
  Status TEXT NOT NULL CHECK (Status IN ('PENDING', 'COPYING', 'COPIED', 'FAILED', 'VERIFIED')),
  ErrorMessage TEXT,
  StartedAt TEXT,
  CompletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_distributionresults_run_device ON DistributionResults (RunId, DeviceKey);

CREATE TABLE IF NOT EXISTS AuditLog (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId INTEGER REFERENCES Users (Id),
  EventType TEXT NOT NULL,
  Message TEXT,
  DetailJson TEXT,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_auditlog_createdat ON AuditLog (CreatedAt);
