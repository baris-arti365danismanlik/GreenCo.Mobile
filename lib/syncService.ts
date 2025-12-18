import { supabase } from './supabase';
import { offlineStorage, PendingAttendanceRecord } from './offlineStorage';

export const syncService = {
  async syncPendingRecords(): Promise<{ success: number; failed: number }> {
    const pendingRecords = await offlineStorage.getPendingAttendances();

    if (pendingRecords.length === 0) {
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const record of pendingRecords) {
      try {
        const recordToInsert = {
          user_id: record.user_id,
          project_id: record.project_id,
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          shift_id: record.shift_id,
          location_lat: record.location_lat,
          location_lon: record.location_lon,
          is_synced: true,
        };

        const { error } = await supabase
          .from('attendance_records')
          .insert(recordToInsert);

        if (error) {
          console.error('Error syncing record:', error);
          failedCount++;
        } else {
          await offlineStorage.removePendingAttendance(record.id);
          successCount++;
        }
      } catch (error) {
        console.error('Exception syncing record:', error);
        failedCount++;
      }
    }

    return { success: successCount, failed: failedCount };
  },

  async getSyncStatus(): Promise<{
    pendingCount: number;
    hasPendingRecords: boolean;
  }> {
    const pendingCount = await offlineStorage.getPendingCount();
    return {
      pendingCount,
      hasPendingRecords: pendingCount > 0,
    };
  },
};
