import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_ATTENDANCE_KEY = '@pending_attendance_records';

export interface PendingAttendanceRecord {
  id: string;
  user_id: string;
  project_id: string;
  check_in_time?: string;
  check_out_time?: string;
  shift_id?: string;
  location_lat?: number;
  location_lon?: number;
  is_synced: boolean;
  timestamp: string;
}

export const offlineStorage = {
  async savePendingAttendance(record: PendingAttendanceRecord): Promise<void> {
    try {
      const existing = await this.getPendingAttendances();
      existing.push(record);
      await AsyncStorage.setItem(PENDING_ATTENDANCE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error('Error saving pending attendance:', error);
      throw error;
    }
  },

  async getPendingAttendances(): Promise<PendingAttendanceRecord[]> {
    try {
      const data = await AsyncStorage.getItem(PENDING_ATTENDANCE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting pending attendances:', error);
      return [];
    }
  },

  async removePendingAttendance(id: string): Promise<void> {
    try {
      const existing = await this.getPendingAttendances();
      const filtered = existing.filter(record => record.id !== id);
      await AsyncStorage.setItem(PENDING_ATTENDANCE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing pending attendance:', error);
      throw error;
    }
  },

  async clearPendingAttendances(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PENDING_ATTENDANCE_KEY);
    } catch (error) {
      console.error('Error clearing pending attendances:', error);
      throw error;
    }
  },

  async getPendingCount(): Promise<number> {
    const records = await this.getPendingAttendances();
    return records.length;
  }
};
