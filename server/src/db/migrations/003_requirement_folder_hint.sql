-- Category A source files (e.g. "Champions_Montpellier - LED1.mp4") don't
-- share any text with their canonical name ("Home Look.mp4") - the real
-- sample data shows the only reliable signal is which source subfolder the
-- file lives in (e.g. "2_Home_Look"). Stored as editable data, not a
-- hardcoded classification branch, so an admin can correct/extend it per
-- event without a code change - see FileDiscoveryService.
ALTER TABLE LED_File_Requirements ADD COLUMN SourceFolderHint TEXT;
