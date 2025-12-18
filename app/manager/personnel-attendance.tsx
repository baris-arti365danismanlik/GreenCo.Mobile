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
  shift_date: string;
  total_hours?: number;
  status: 'complete' | 'incomplete' | 'no_checkout';
  performance_rating?: number;
  performance_notes?: string;
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
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
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
    console.log('useEffect - personnelId:', personnelId);
    if (personnelId) {
      loadPersonnelInfo();
    } else {
      console.log('personnelId yok!');
    }
  }, [personnelId]);

  useEffect(() => {
    if (personnelId) {
      loadAttendanceData();
    }
  }, [personnelId, currentMonth, projectId]);

  useEffect(() => {
    console.log('personnel state güncellendi:', personnel);
  }, [personnel]);

  const loadPersonnelInfo = async () => {
    console.log('loadPersonnelInfo başladı - personnelId:', personnelId);
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

      console.log('Supabase response - data:', data, 'error:', error);

      if (error) throw error;

      if (data) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const { data: todayAttendance } = await supabase
          .from('attendance_records')
          .select('check_in_time, check_out_time')
          .eq('worker_id', personnelId)
          .eq('project_id', projectId)
          .gte('check_in_time', todayStart.toISOString())
          .maybeSingle();

        const isWorking = todayAttendance && todayAttendance.check_in_time && !todayAttendance.check_out_time;

        const personnelData = {
          id: data.id,
          full_name: data.full_name,
          avatar_url: data.avatar_url || undefined,
          personnel_type: (data.personnel_types as any)?.name || undefined,
          isWorking: isWorking,
        };
        console.log('Personnel data loaded:', personnelData);
        setPersonnel(personnelData);
      } else {
        console.log('Data gelmedi - personnel bulunamadı');
      }
    } catch (error) {
      console.error('Error loading personnel:', error);
    }
  };

  const loadAttendanceData = async () => {
    setLoading(true);
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

      if (attendanceError) {
        console.error('Attendance error:', attendanceError);
        throw attendanceError;
      }

      if (!attendanceRecords || attendanceRecords.length === 0) {
        setAttendanceData([]);
        setStats({ totalDays: 0, avgHours: 0, totalOvertime: 0, totalUndertime: 0 });
        setLoading(false);
        return;
      }

      const processedData: AttendanceRecord[] = attendanceRecords.map(attendance => {
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

        const shiftDate = new Date(attendance.check_in_time);
        const dateString = shiftDate.toISOString().split('T')[0];

        return {
          id: attendance.id,
          check_in_time: attendance.check_in_time || '',
          check_out_time: attendance.check_out_time,
          shift_date: dateString,
          total_hours: totalHours,
          status,
          performance_rating: attendance.performance_rating,
          performance_notes: attendance.performance_notes,
        };
      });

      setAttendanceData(processedData);
      calculateStats(processedData);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: AttendanceRecord[]) => {
    const completeDays = data.filter(d => d.status === 'complete');
    const totalDays = completeDays.length;
    const totalHours = completeDays.reduce((sum, d) => sum + (d.total_hours || 0), 0);
    const avgHours = totalDays > 0 ? totalHours / totalDays : 0;

    let totalOvertime = 0;
    let totalUndertime = 0;

    completeDays.forEach(day => {
      const hours = day.total_hours || 0;
      if (hours > 8) {
        totalOvertime += hours - 8;
      } else if (hours < 8) {
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

  const getDayCardStyle = (record: AttendanceRecord) => {
    if (record.status === 'incomplete') {
      return { backgroundColor: '#fee2e2', borderColor: '#dc2626' };
    }
    if (record.status === 'no_checkout') {
      return { backgroundColor: '#fed7aa', borderColor: '#ea580c' };
    }
    const hours = record.total_hours || 0;
    if (hours < 7) {
      return { backgroundColor: '#fed7aa', borderColor: '#ea580c' };
    }
    if (hours > 9) {
      return { backgroundColor: '#fef3c7', borderColor: '#f59e0b' };
    }
    return { backgroundColor: '#dcfce7', borderColor: '#16a34a' };
  };

  const getDayIcon = (record: AttendanceRecord) => {
    if (record.status === 'incomplete') {
      return <XCircle size={20} color="#dc2626" />;
    }
    if (record.status === 'no_checkout') {
      return <AlertCircle size={20} color="#ea580c" />;
    }
    const hours = record.total_hours || 0;
    if (hours < 7 || hours > 9) {
      return <AlertCircle size={20} color="#f59e0b" />;
    }
    return <CheckCircle size={20} color="#16a34a" />;
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
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

      // Timesheet detail sayfasına geri dönüyorsa refresh trigger ile
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
        ) : attendanceData.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Bu ay için kayıt bulunmuyor</Text>
          </View>
        ) : (
          <View style={styles.calendarContainer}>
            {attendanceData.map((record) => (
              <View
                key={record.id}
                style={[styles.dayCard, getDayCardStyle(record)]}
              >
                <View style={styles.dayHeader}>
                  <Text style={styles.dayDate}>{formatDate(record.shift_date)}</Text>
                  {getDayIcon(record)}
                </View>
                {record.status === 'incomplete' ? (
                  <Text style={styles.noDataText}>Giriş yapılmadı</Text>
                ) : (
                  <>
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
                    {record.total_hours && record.total_hours > 0 ? (
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Toplam:</Text>
                        <Text style={styles.totalValue}>{formatHours(record.total_hours)}</Text>
                      </View>
                    ) : null}
                    {record.status === 'complete' && (
                      <>
                        <View style={styles.ratingSection}>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={20}
                                color={record.performance_rating && record.performance_rating >= star ? '#fbbf24' : '#d1d5db'}
                                fill={record.performance_rating && record.performance_rating >= star ? '#fbbf24' : 'transparent'}
                              />
                            ))}
                          </View>
                          {record.performance_notes && (
                            <View style={styles.notesPreview}>
                              <MessageSquare size={14} color={COLORS.textLight} />
                              <Text style={styles.notesPreviewText} numberOfLines={1}>
                                {record.performance_notes}
                              </Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.rateButton}
                          onPress={() => openRatingModal(record)}
                        >
                          <Star size={16} color="white" />
                          <Text style={styles.rateButtonText}>
                            {record.performance_rating ? 'Puanı Düzenle' : 'Puanla'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setRatingModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Performans Puanlama</Text>
            <Text style={styles.modalSubtitle}>
              {selectedRecord && formatDate(selectedRecord.shift_date)}
            </Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Star
                    size={32}
                    color={rating >= star ? '#fbbf24' : '#d1d5db'}
                    fill={rating >= star ? '#fbbf24' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Not (Opsiyonel)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Performans hakkında notlarınız..."
              placeholderTextColor={COLORS.textLight}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setRatingModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveRating}
              >
                <Text style={styles.saveButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
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
    marginBottom: 12,
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
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
  noDataText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  ratingSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  notesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  notesPreviewText: {
    fontSize: 12,
    color: COLORS.textLight,
    flex: 1,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  rateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    zIndex: 1,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  starButton: {
    padding: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.bg,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
