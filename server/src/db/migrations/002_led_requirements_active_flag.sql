-- Stage 4: re-imports must never hard-delete a requirement that historical
-- ProcessingFiles/RenamedAssets rows reference (would break traceability and
-- violate the FK). Rows missing from a newer CSV are soft-deactivated instead.
ALTER TABLE LED_File_Requirements ADD COLUMN IsActive INTEGER NOT NULL DEFAULT 1;
