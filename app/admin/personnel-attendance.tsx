import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
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
  phone?: string;
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

export default function PersonnelAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const personnelId = params.personnelId as string;

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

  useEffect(() => {
    loadPersonnelInfo();
  }, [personnelId]);

  useEffect(() => {
    if (personnelId) {
      loadAttendanceData();
    }
  }, [personnelId, currentMonth]);

  const loadPersonnelInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          avatar_url,
          phone,
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

        const { data: todayAttendance } = await supabase
          .from('attendance_records')
          .select('check_in_time, check_out_time')
          .eq('worker_id', personnelId)
          .gte('check_in_time', todayStart.toISOString())
          .maybeSingle();

        const isWorking = todayAttendance && todayAttendance.check_in_time && !todayAttendance.check_out_time;

        setPersonnel({
          id: data.id,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          phone: data.phone,
          personnel_type: data.personnel_types?.name || undefined,
          isWorking: isWorking,
        });
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

      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];

      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, shift_date, project_id')
        .eq('worker_id', personnelId)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate)
        .order('shift_date', { ascending: true });

      if (shiftsError) throw shiftsError;

      if (!shifts || shifts.length === 0) {
        setAttendanceData([]);
        setStats({ totalDays: 0, avgHours: 0, totalOvertime: 0, totalUndertime: 0 });
        setLoading(false);
        return;
      }

      const shiftIds = shifts.map(s => s.id);

      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .in('shift_id', shiftIds);

      if (attendanceError) throw attendanceError;

      const processedData: AttendanceRecord[] = shifts.map(shift => {
        const attendance = attendanceRecords?.find(a => a.shift_id === shift.id);

        if (!attendance) {
          return {
            id: shift.id,
            check_in_time: '',
            check_out_time: undefined,
            shift_date: shift.shift_date,
            total_hours: 0,
            status: 'incomplete' as const,
          };
        }

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

        return {
          id: attendance.id,
          check_in_time: attendance.check_in_time || '',
          check_out_time: attendance.check_out_time,
          shift_date: shift.shift_date,
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
              <Image source={{ uri: personnel.avatar_url }} style={styles.avatar} />
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
            {personnel?.phone && (
              <Text style={styles.personnelPhone}>{personnel.phone}</Text>
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
                    {record.status === 'complete' && (record.performance_rating || record.performance_notes) && (
                      <View style={styles.ratingSection}>
                        {record.performance_rating && (
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={16}
                                color={record.performance_rating && record.performance_rating >= star ? '#fbbf24' : '#d1d5db'}
                                fill={record.performance_rating && record.performance_rating >= star ? '#fbbf24' : 'transparent'}
                              />
                            ))}
                          </View>
                        )}
                        {record.performance_notes && (
                          <View style={styles.notesPreview}>
                            <MessageSquare size={14} color={COLORS.textLight} />
                            <Text style={styles.notesPreviewText}>{record.performance_notes}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  personnelPhone: {
    fontSize: 13,
    color: COLORS.textLight,
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
    alignItems: 'flex-start',
    gap: 6,
  },
  notesPreviewText: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
    lineHeight: 18,
  },
});
