import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, TrendingUp, TrendingDown, Star, CheckCircle2, XCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type TimesheetPeriod = {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_hours: number;
  total_personnel: number;
  project: { name: string };
};

type PersonnelAttendance = {
  worker_id: string;
  full_name: string;
  avatar_url?: string;
  total_hours: number;
  total_days: number;
  overtime: number;
  undertime: number;
  personnel_type?: string;
  avg_rating?: number;
  rated_days: number;
  total_work_days: number;
};

const calculateWorkDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workDays = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDays++;
    }
  }
  return workDays;
};

export default function TimesheetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const timesheetId = params.id as string;
  const refreshTrigger = params.refresh as string;
  const { profile } = useAuth();

  const [timesheet, setTimesheet] = useState<TimesheetPeriod | null>(null);
  const [personnelData, setPersonnelData] = useState<PersonnelAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expectedWorkDays, setExpectedWorkDays] = useState(0);

  const loadTimesheetDetail = useCallback(async () => {
    try {
      const { data: timesheetData, error: timesheetError } = await supabase
        .from('timesheet_periods')
        .select(`
          *,
          projects_greenco!inner (
            name
          )
        `)
        .eq('id', timesheetId)
        .single();

      if (timesheetError) throw timesheetError;

      const formattedTimesheet = {
        ...timesheetData,
        project: { name: timesheetData.projects_greenco?.name }
      };
      setTimesheet(formattedTimesheet);

      const workDays = calculateWorkDays(timesheetData.period_start, timesheetData.period_end);
      setExpectedWorkDays(workDays);

      // 1. Fetch Attendance Records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          worker_id,
          total_hours,
          check_in_time,
          check_out_time,
          performance_rating,
          profiles!attendance_records_worker_id_fkey (
            full_name,
            avatar_url,
            personnel_types (name)
          )
        `)
        .eq('project_id', timesheetData.project_id)
        .gte('check_in_time', `${timesheetData.period_start}T00:00:00`)
        .lte('check_in_time', `${timesheetData.period_end}T23:59:59`);

      if (attendanceError) throw attendanceError;

      // 2. Fetch Manager Personnel (Source of Truth for Names via Edge Function)
      let managerPersonnelMap = new Map<string, any>();
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.access_token) {
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-manager-personnel`,
            {
              headers: {
                'Authorization': `Bearer ${session.session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const result = await response.json();
            const allPersonnel = result.data || [];
            allPersonnel.forEach((p: any) => {
              managerPersonnelMap.set(p.id, p);
            });
          }
        }
      } catch (err) {
        console.error('Error fetching manager personnel:', err);
      }

      const personnelMap = new Map<string, PersonnelAttendance>();

      attendanceData?.forEach((record: any) => {
        const workerId = record.worker_id;
        const hours = Number(record.total_hours) || 0;
        const isComplete = record.check_in_time && record.check_out_time;

        if (!personnelMap.has(workerId)) {
          // Try to get info from Edge Function map first, fallback to Join result
          const edgeProfile = managerPersonnelMap.get(workerId);
          const joinProfile = record.profiles;

          const fullName = edgeProfile?.full_name || joinProfile?.full_name || 'Bilinmiyor';
          const avatarUrl = edgeProfile?.avatar_url || joinProfile?.avatar_url;
          const position = edgeProfile?.personnel_types?.name || joinProfile?.personnel_types?.name;

          personnelMap.set(workerId, {
            worker_id: workerId,
            full_name: fullName,
            avatar_url: avatarUrl,
            personnel_type: position,
            total_hours: 0,
            total_days: 0,
            overtime: 0,
            undertime: 0,
            avg_rating: 0,
            rated_days: 0,
            total_work_days: 0,
          });
        }

        const personnel = personnelMap.get(workerId)!;
        personnel.total_hours += hours;
        personnel.total_days += 1;

        if (isComplete) {
          personnel.total_work_days += 1;
          if (record.performance_rating) {
            personnel.avg_rating = (personnel.avg_rating || 0) + record.performance_rating;
            personnel.rated_days += 1;
          }
        }
      });

      const personnelArray = Array.from(personnelMap.values()).map(p => {
        const expectedHours = workDays * 8;
        const overtime = Math.max(0, p.total_hours - expectedHours);
        const undertime = Math.max(0, expectedHours - p.total_hours);
        const avgRating = p.rated_days > 0 && p.avg_rating ? p.avg_rating / p.rated_days : 0;

        return {
          ...p,
          overtime,
          undertime,
          avg_rating: avgRating,
        };
      });

      personnelArray.sort((a, b) => b.total_hours - a.total_hours);
      setPersonnelData(personnelArray);
    } catch (error) {
      console.error('Detay yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  }, [timesheetId]);

  useEffect(() => {
    loadTimesheetDetail();
  }, [loadTimesheetDetail, refreshTrigger]);

  useFocusEffect(
    useCallback(() => {
      loadTimesheetDetail();
    }, [loadTimesheetDetail])
  );

  if (loading || !timesheet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending_manager':
        return { label: 'Onay Bekliyor', color: COLORS.warning };
      case 'approved_manager':
        return { label: 'Onaylandı', color: COLORS.success };
      case 'rejected_manager':
        return { label: 'Reddedildi', color: COLORS.danger };
      case 'final_approved':
        return { label: 'Kesinleşti', color: COLORS.primary };
      default:
        return { label: 'Taslak', color: COLORS.textLight };
    }
  };

  const statusConfig = getStatusConfig(timesheet.status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Puantaj Detayı</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.projectName}>{timesheet.project?.name || 'Proje'}</Text>

          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          <View style={styles.dateContainer}>
            <Calendar size={16} color={COLORS.textLight} />
            <Text style={styles.dateText}>
              {new Date(timesheet.period_start).toLocaleDateString('tr-TR')} -{' '}
              {new Date(timesheet.period_end).toLocaleDateString('tr-TR')}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Clock size={20} color={COLORS.primary} />
              <Text style={styles.statValue}>{timesheet.total_hours}h</Text>
              <Text style={styles.statLabel}>Toplam Saat</Text>
            </View>
            <View style={styles.statBox}>
              <User size={20} color={COLORS.blue} />
              <Text style={styles.statValue}>{personnelData.length}</Text>
              <Text style={styles.statLabel}>Çalışan</Text>
            </View>
            <View style={styles.statBox}>
              <Calendar size={20} color={COLORS.purple} />
              <Text style={styles.statValue}>{expectedWorkDays}</Text>
              <Text style={styles.statLabel}>İş Günü</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>PERSONEL DETAYLARI ({personnelData.length})</Text>

        {personnelData.map((person, index) => (
          <View key={person.worker_id} style={styles.personnelCard}>
            <View style={styles.personnelHeader}>
              {person.avatar_url ? (
                <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={24} color={COLORS.textLight} />
                </View>
              )}
              <View style={styles.personnelInfo}>
                <Text style={styles.personnelName}>{person.full_name}</Text>
                {person.personnel_type && (
                  <Text style={styles.personnelType}>{person.personnel_type}</Text>
                )}
              </View>
              <Text style={styles.rankBadge}>#{index + 1}</Text>
            </View>

            <View style={styles.personnelStats}>
              <View style={styles.personnelStatItem}>
                <Text style={styles.personnelStatLabel}>Toplam Saat</Text>
                <Text style={styles.personnelStatValue}>{person.total_hours.toFixed(1)}h</Text>
              </View>
              <View style={styles.personnelStatItem}>
                <Text style={styles.personnelStatLabel}>Çalışma Günü</Text>
                <Text style={styles.personnelStatValue}>{person.total_days}</Text>
              </View>
            </View>

            <View style={styles.performanceContainer}>
              {person.overtime > 0 && (
                <View style={styles.performanceItem}>
                  <TrendingUp size={16} color={COLORS.success} />
                  <Text style={[styles.performanceText, { color: COLORS.success }]}>
                    +{person.overtime.toFixed(1)}h Fazla Mesai
                  </Text>
                </View>
              )}
              {person.undertime > 0 && (
                <View style={styles.performanceItem}>
                  <TrendingDown size={16} color={COLORS.warning} />
                  <Text style={[styles.performanceText, { color: COLORS.warning }]}>
                    -{person.undertime.toFixed(1)}h Eksik
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.ratingContainer}>
              <View style={styles.ratingRow}>
                <View style={styles.starsDisplay}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      color={person.avg_rating && person.avg_rating >= star ? '#fbbf24' : '#d1d5db'}
                      fill={person.avg_rating && person.avg_rating >= star ? '#fbbf24' : 'transparent'}
                    />
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {person.avg_rating ? person.avg_rating?.toFixed(1) : '-'}
                </Text>
              </View>
              <View style={styles.ratingProgress}>
                <Text style={[
                  styles.ratingProgressText,
                  person.rated_days === person.total_work_days ? { color: COLORS.success } : { color: COLORS.warning }
                ]}>
                  {person.rated_days}/{person.total_work_days} gün puanlandı
                </Text>
                {person.rated_days < person.total_work_days && (
                  <XCircle size={14} color={COLORS.warning} />
                )}
                {person.rated_days === person.total_work_days && person.total_work_days > 0 && (
                  <CheckCircle2 size={14} color={COLORS.success} />
                )}
              </View>
              {timesheet.status === 'pending_manager' && person.rated_days < person.total_work_days && (
                <TouchableOpacity
                  style={styles.ratePersonnelButton}
                  onPress={() => router.push(`/manager/personnel-attendance?personnelId=${person.worker_id}&projectId=${timesheet.project_id}&returnTo=timesheet-detail&timesheetId=${timesheetId}`)}
                >
                  <Star size={14} color={COLORS.primary} />
                  <Text style={styles.ratePersonnelButtonText}>Puanlamaya Git</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {personnelData.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Bu dönemde devamsızlık kaydı bulunmuyor</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textLight,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  projectName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.text,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 12,
    letterSpacing: 1,
  },
  personnelCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personnelInfo: {
    flex: 1,
  },
  personnelName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 2,
  },
  personnelType: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  rankBadge: {
    backgroundColor: COLORS.primary + '20',
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  personnelStats: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  personnelStatItem: {
    flex: 1,
  },
  personnelStatLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  personnelStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  performanceContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performanceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  ratingContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  starsDisplay: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  ratingProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingProgressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ratePersonnelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
  },
  ratePersonnelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
