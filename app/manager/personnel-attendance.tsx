import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, XCircle, Calendar, User, Star, MessageSquare } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type AttendanceRecord = {
  id: string;
  check_in_time: string;
  check_out_time?: string;
  total_hours?: number;
  status: 'complete' | 'incomplete' | 'no_checkout';
  performance_rating?: number;
  performance_notes?: string;
};

type GroupedAttendance = {
  date: string; // YYYY-MM-DD
  total_hours: number;
  status: 'complete' | 'incomplete' | 'no_checkout'; // Day status (worst case of records)
  records: AttendanceRecord[];
};

type PersonnelInfo = {
  id: string;
  full_name: string;
  avatar_url?: string;
  personnel_type?: string;
  isWorking?: boolean;
};

type MonthStats = {
  totalDays: number;
  avgHours: number;
  totalOvertime: number;
  totalUndertime: number;
};

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export default function ManagerPersonnelAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const personnelId = params.personnelId as string;
  const projectId = params.projectId as string;
  const returnTo = params.returnTo as string;
  const timesheetId = params.timesheetId as string;

  const [personnel, setPersonnel] = useState<PersonnelInfo | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [groupedData, setGroupedData] = useState<GroupedAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonthStats>({
    totalDays: 0,
    avgHours: 0,
    totalOvertime: 0,
    totalUndertime: 0,
  });
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (personnelId) {
      loadPersonnelInfo();
    }
  }, [personnelId]);

  useEffect(() => {
    if (personnelId) {
      loadData();
    }
  }, [personnelId, projectId, currentMonth]);

  const loadData = async () => {
    setLoading(true);
    if (!personnel) {
      await loadPersonnelInfo();
    }
    await loadAttendanceData();
    setLoading(false);
  };

  const loadPersonnelInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          avatar_url,
          personnel_types (
            name
          )
        `)
        .eq('id', personnelId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Check if ANY active record exists for this project today
        const { data: todayAttendance } = await supabase
          .from('attendance_records')
          .select('check_in_time, check_out_time')
          .eq('worker_id', personnelId)
          .eq('project_id', projectId)
          .gte('check_in_time', todayStart.toISOString());

        const isWorking = todayAttendance?.some(r => r.check_in_time && !r.check_out_time) || false;

        const personnelData = {
          id: data.id,
          full_name: data.full_name,
          avatar_url: data.avatar_url || undefined,
          personnel_type: (data.personnel_types as any)?.name || undefined,
          isWorking: isWorking,
        };
        setPersonnel(personnelData);
      }
    } catch (error) {
      console.error('Error loading personnel:', error);
    }
  };

  const loadAttendanceData = async () => {
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const startDate = startOfMonth.toISOString();
      const endDate = new Date(endOfMonth.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id, check_in_time, check_out_time, shift_id, worker_id, project_id, performance_rating, performance_notes')
        .eq('worker_id', personnelId)
        .eq('project_id', projectId)
        .gte('check_in_time', startDate)
        .lt('check_in_time', endDate)
        .order('check_in_time', { ascending: true });

      if (attendanceError) throw attendanceError;

      if (!attendanceRecords || attendanceRecords.length === 0) {
        setGroupedData([]);
        setStats({ totalDays: 0, avgHours: 0, totalOvertime: 0, totalUndertime: 0 });
        return;
      }

      // GROUP BY DATE LOGIC
      const groups: { [date: string]: GroupedAttendance } = {};

      attendanceRecords.forEach(attendance => {
        const checkInDate = new Date(attendance.check_in_time);
        const dateKey = checkInDate.toISOString().split('T')[0];

        let totalHours = 0;
        let status: 'complete' | 'incomplete' | 'no_checkout' = 'incomplete';

        if (attendance.check_in_time && attendance.check_out_time) {
          const checkIn = new Date(attendance.check_in_time);
          const checkOut = new Date(attendance.check_out_time);
          totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          status = 'complete';
        } else if (attendance.check_in_time && !attendance.check_out_time) {
          status = 'no_checkout';
        }

        const record: AttendanceRecord = {
          id: attendance.id,
          check_in_time: attendance.check_in_time || '',
          check_out_time: attendance.check_out_time,
          total_hours: totalHours,
          status,
          performance_rating: attendance.performance_rating,
          performance_notes: attendance.performance_notes,
        };

        if (!groups[dateKey]) {
          groups[dateKey] = {
            date: dateKey,
            total_hours: 0,
            status: 'complete', // Start optimistic, downgrade if we find incomplete records
            records: [],
          };
        }

        groups[dateKey].records.push(record);
        groups[dateKey].total_hours += totalHours;

        // Downgrade status logic: no_checkout > incomplete > complete
        // If there is ANY active record, day status is no_checkout
        if (status === 'no_checkout') {
          groups[dateKey].status = 'no_checkout';
        } else if (status === 'incomplete' && groups[dateKey].status !== 'no_checkout') {
          groups[dateKey].status = 'incomplete';
        }
      });

      const groupedArray = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

      setGroupedData(groupedArray);
      calculateStats(groupedArray);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const calculateStats = (data: GroupedAttendance[]) => {
    // Only count days where at least one shift is complete or waiting (no_checkout still counts as active day)
    const workingDays = data.filter(d => d.records.length > 0);
    const totalDays = workingDays.length;

    // Sum all hours from all days
    const totalHours = workingDays.reduce((sum, d) => sum + d.total_hours, 0);

    const avgHours = totalDays > 0 ? totalHours / totalDays : 0;

    let totalOvertime = 0;
    let totalUndertime = 0;

    workingDays.forEach(day => {
      // Calculate daily overtime/undertime based on the DAY's total
      const hours = day.total_hours || 0;
      if (hours > 8) {
        totalOvertime += hours - 8;
      } else if (hours < 8 && day.status !== 'no_checkout') {
        // Only count undertime if the day is fully closed. 
        // If they are still checked in (no_checkout), don't count logical undertime yet.
        totalUndertime += 8 - hours;
      }
    });

    setStats({
      totalDays,
      avgHours,
      totalOvertime,
      totalUndertime,
    });
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${dayNames[date.getDay()]}`;
  };

  const getDayCardStyle = (group: GroupedAttendance) => {
    if (group.status === 'incomplete') {
      return { backgroundColor: '#fee2e2', borderColor: '#dc2626' };
    }
    if (group.status === 'no_checkout') {
      return { backgroundColor: '#fed7aa', borderColor: '#ea580c' };
    }
    const hours = group.total_hours || 0;
    if (hours < 7) {
      return { backgroundColor: '#fed7aa', borderColor: '#ea580c' }; // Yellow/Orange for undertime
    }
    if (hours > 9) {
      return { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }; // Yellow for overtime
    }
    return { backgroundColor: '#dcfce7', borderColor: '#16a34a' }; // Green for standard
  };

  const getDayIcon = (group: GroupedAttendance) => {
    if (group.status === 'incomplete') {
      return <XCircle size={20} color="#dc2626" />;
    }
    if (group.status === 'no_checkout') {
      return <AlertCircle size={20} color="#ea580c" />;
    }
    const hours = group.total_hours || 0;
    if (hours < 7 || hours > 9) {
      return <AlertCircle size={20} color="#f59e0b" />;
    }
    return <CheckCircle size={20} color="#16a34a" />;
  };

  const formatHours = (hours: number) => {
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);

    if (m === 60) {
      h += 1;
      m = 0;
    }

    return `${h}s ${m}dk`;
  };

  const openRatingModal = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setRating(record.performance_rating || 0);
    setNotes(record.performance_notes || '');
    setRatingModalVisible(true);
  };

  const saveRating = async () => {
    if (!selectedRecord || rating === 0) {
      Alert.alert('Uyarı', 'Lütfen puan seçiniz');
      return;
    }

    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          performance_rating: rating,
          performance_notes: notes || null,
        })
        .eq('id', selectedRecord.id);

      if (error) throw error;

      await loadAttendanceData();
      setRatingModalVisible(false);

      if (returnTo === 'timesheet-detail' && timesheetId) {
        setTimeout(() => {
          router.push(`/manager/timesheet-detail?id=${timesheetId}&refresh=${Date.now()}`);
        }, 300);
      }
    } catch (error) {
      Alert.alert('Hata', 'Puanlama kaydedilemedi: ' + (error as any).message);
    }
  };

  if (loading && !personnel) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Devam Detayı</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.personnelCard}>
          <View style={styles.avatarContainer}>
            {personnel?.avatar_url ? (
              <Image
                source={{ uri: personnel.avatar_url }}
                style={styles.avatar}
                onError={() => console.log('Avatar yüklenemedi:', personnel.avatar_url)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={32} color="white" />
              </View>
            )}
            {personnel?.isWorking && (
              <View style={styles.workingIndicator} />
            )}
          </View>
          <View style={styles.personnelInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.personnelName}>{personnel?.full_name}</Text>
              {personnel?.isWorking && (
                <View style={styles.workingBadge}>
                  <Clock size={10} color={COLORS.success} />
                  <Text style={styles.workingText}>Mesaide</Text>
                </View>
              )}
            </View>
            {personnel?.personnel_type && (
              <Text style={styles.personnelType}>{personnel.personnel_type}</Text>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Calendar size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats.totalDays}</Text>
            <Text style={styles.statLabel}>Çalışma Günü</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats.avgHours.toFixed(1)}s</Text>
            <Text style={styles.statLabel}>Ortalama</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircle size={20} color="#16a34a" />
            <Text style={[styles.statValue, { color: '#16a34a' }]}>
              +{formatHours(stats.totalOvertime)}
            </Text>
            <Text style={styles.statLabel}>Fazla Mesai</Text>
          </View>
          <View style={styles.statCard}>
            <AlertCircle size={20} color="#dc2626" />
            <Text style={[styles.statValue, { color: '#dc2626' }]}>
              -{formatHours(stats.totalUndertime)}
            </Text>
            <Text style={styles.statLabel}>Eksik Mesai</Text>
          </View>
        </View>

        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth('prev')} style={styles.monthBtn}>
            <ChevronLeft size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => changeMonth('next')} style={styles.monthBtn}>
            <ChevronRight size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : groupedData.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Bu ay için kayıt bulunmuyor</Text>
          </View>
        ) : (
          <View style={styles.calendarContainer}>
            {groupedData.map((group) => (
              <View
                key={group.date}
                style={[styles.dayCard, getDayCardStyle(group)]}
              >
                <View style={[styles.dayHeader, { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 8, marginBottom: 8 }]}>
                  <Text style={styles.dayDate}>{formatDate(group.date)}</Text>
                  {getDayIcon(group)}
                </View>

                {group.records.map((record, index) => (
                  <View key={record.id} style={{ marginBottom: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: 'rgba(0,0,0,0.1)' }}>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeLabel}>Giriş:</Text>
                      <Text style={styles.timeValue}>{formatTime(record.check_in_time)}</Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeLabel}>Çıkış:</Text>
                      <Text style={styles.timeValue}>
                        {record.check_out_time ? formatTime(record.check_out_time) : 'Bekliyor'}
                      </Text>
                    </View>
                    {record.status === 'complete' && (record.performance_rating || record.performance_notes) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                        {record.performance_rating && (
                          <Star size={12} color="#fbbf24" fill="#fbbf24" />
                        )}
                        <Text style={{ fontSize: 10, color: COLORS.textLight }}>
                          {record.performance_notes ? 'Notlu Puanlama' : 'Puanlandı'}
                        </Text>
                      </View>
                    )}

                    {/* Puanlama Butonu (Sadece tamamlanmış vardiyalar için) */}
                    {record.status === 'complete' && (
                      <TouchableOpacity
                        style={{
                          marginTop: 4,
                          backgroundColor: COLORS.primary,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 4,
                          alignSelf: 'flex-start'
                        }}
                        onPress={() => openRatingModal(record)}
                      >
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>
                          {record.performance_rating ? 'Puanı Güncelle' : 'Puanla'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Günlük Toplam:</Text>
                  <Text style={styles.totalValue}>{formatHours(group.total_hours)}</Text>
                </View>

              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* RATING MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={ratingModalVisible}
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personeli Puanla</Text>
              <TouchableOpacity onPress={() => setRatingModalVisible(false)}>
                <XCircle size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                >
                  <Star
                    size={32}
                    color={rating >= star ? '#fbbf24' : '#e5e7eb'}
                    fill={rating >= star ? '#fbbf24' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ textAlign: 'center', marginBottom: 16, color: COLORS.textLight }}>
              {rating === 0 ? 'Puan Seçiniz' : `${rating} Yıldız`}
            </Text>

            <Text style={styles.inputLabel}>Notlar (İsteğe bağlı)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Performans hakkında notlar..."
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveRating}>
              <Text style={styles.saveButtonText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  content: {
    flex: 1,
  },
  personnelCard: {
    backgroundColor: 'white',
    padding: 16,
    margin: 20,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workingIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: 'white',
  },
  workingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  workingText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
  },
  personnelInfo: {
    flex: 1,
  },
  personnelName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  personnelType: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  monthBtn: {
    padding: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginHorizontal: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 12,
  },
  calendarContainer: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  dayCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  timeLabel: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});
