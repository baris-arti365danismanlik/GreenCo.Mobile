-- Drop the unique index that prevents multiple active shifts per worker
-- Note: The index name might vary, this tries to drop likely candidates or you might need to check your specific index name.
-- Common naming convention:
DROP INDEX IF EXISTS idx_attendance_active_worker;
DROP INDEX IF EXISTS attendance_records_worker_id_check_out_time_null_idx;
DROP INDEX IF EXISTS unique_active_attendance;

-- If you have a constraint instead of just an index:
-- ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS unique_active_attendance;
