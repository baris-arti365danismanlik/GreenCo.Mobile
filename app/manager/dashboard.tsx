import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users, TrendingUp, CheckCircle, XCircle, Award, Calendar, Package, MapPin, FileText } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { GreencoLogo } from '@/components/GreencoLogo';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type DashboardStats = {
  activePersonnel: number;
  avgPerformance: number;
  checkedInToday: number;
  notCheckedInToday: number;
  topPerformer: { name: string; rating: number } | null;
  monthlyOutsource: number;
  employeeOfMonth: { name: string; rating: number; attendance: number } | null;
};

type ProblematicItem = {
  type: 'asset' | 'location';
  label: string;
  sublabel?: string;
  count: number;
};

export default function ManagerDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activePersonnel: 0,
    avgPerformance: 0,
    checkedInToday: 0,
    notCheckedInToday: 0,
    topPerformer: null,
    monthlyOutsource: 0,
    employeeOfMonth: null,
  });
  const [problematicItems, setProblematicItems] = useState<ProblematicItem[]>([]);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardStats();
    }
  }, [profile]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      const { data: managedProjects } = await supabase
        .from('project_managers')
        .select('project_id')
        .eq('manager_id', profile!.id)
        .eq('manager_id', profile!.id);

      const projectIds = managedProjects?.map(pm => pm.project_id) || [];

      if (projectIds.length === 0) {
        setLoading(false);
        return;
      }

      // 1. Calculate Active Personnel correctly
      // We check for assignments that are NOT removed (removed_at is null)
      // We removed is_active check because the column likely doesn't exist on project_assignments table
      const { count: activePersonnelCount, error: assignmentsError } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .is('removed_at', null);

      const activePersonnel = activePersonnelCount || 0;

      const today = new Date().toISOString().split('T')[0];

      const { data: todayShifts } = await supabase
        .from('shifts')
        .select('id')
        .in('project_id', projectIds)
        .eq('shift_date', today);

      const shiftIds = todayShifts?.map(s => s.id) || [];

      let checkedInToday = 0;
      let notCheckedInToday = 0;

      if (shiftIds.length > 0) {
        const { data: attendanceRecords } = await supabase
          .from('attendance_records')
          .select('worker_id, check_in_time')
          .in('shift_id', shiftIds);

        const checkedInWorkers = new Set(
          attendanceRecords?.filter(a => a.check_in_time).map(a => a.worker_id) || []
        );

        checkedInToday = checkedInWorkers.size;
        // Fix duplicate count issues by ensuring we don't go below 0
        notCheckedInToday = Math.max(0, activePersonnel - checkedInToday);
      } else {
        notCheckedInToday = activePersonnel;
      }

      // Calculate Monthly Statistics (Performance, Employee of Month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      // Fetch IDs of all shifts in this month once
      const { data: monthlyShifts } = await supabase
        .from('shifts')
        .select('id')
        .in('project_id', projectIds)
        .gte('shift_date', firstDayOfMonth)
        .lte('shift_date', lastDayOfMonth);

      const monthlyShiftIds = monthlyShifts?.map(s => s.id) || [];

      // A. Calculate Avg Performance & Top Performer
      let avgPerformance = 0;
      let topPerformer = null;

      if (monthlyShiftIds.length > 0) {
        const { data: performanceRecords } = await supabase
          .from('attendance_records')
          .select('worker_id, performance_rating, profiles(full_name)')
          .in('shift_id', monthlyShiftIds)
          .not('performance_rating', 'is', null);

        const ratings = performanceRecords?.map(r => r.performance_rating) || [];
        avgPerformance = ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
          : 0;

        if (performanceRecords && performanceRecords.length > 0) {
          const sorted = [...performanceRecords].sort((a, b) => b.performance_rating - a.performance_rating);
          const top = sorted[0];
          const profile = Array.isArray(top.profiles) ? top.profiles[0] : top.profiles;
          topPerformer = {
            name: profile?.full_name || 'Bilinmeyen',
            rating: top.performance_rating,
          };
        }
      }

      // B. Calculate Outsource Usage
      const { data: monthlyAssignments } = await supabase
        .from('project_assignments')
        .select('worker_id, profiles!inner(personnel_type), created_at')
        .in('project_id', projectIds)
        .eq('is_active', true);

      const monthlyOutsource = monthlyAssignments?.filter(a => {
        const createdDate = new Date(a.created_at);
        const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return (
          profile?.personnel_type === 'outsource' &&
          createdDate.getMonth() === currentMonth &&
          createdDate.getFullYear() === currentYear
        );
      }).length || 0;

      // C. Employee of the Month (uses exact same monthlyShiftIds)

      let employeeOfMonth = null;
      if (monthlyShiftIds.length > 0) {
        const { data: monthlyAttendance } = await supabase
          .from('attendance_records')
          .select('worker_id, performance_rating, profiles!inner(full_name)')
          .in('shift_id', monthlyShiftIds)
          .not('performance_rating', 'is', null);

        const workerStats = monthlyAttendance?.reduce((acc: any, record: any) => {
          const workerId = record.worker_id;
          if (!acc[workerId]) {
            acc[workerId] = {
              name: record.profiles.full_name,
              totalRating: 0,
              count: 0,
            };
          }
          acc[workerId].totalRating += record.performance_rating;
          acc[workerId].count += 1;
          return acc;
        }, {});

        if (workerStats && Object.keys(workerStats).length > 0) {
          const bestWorker = Object.values(workerStats).reduce((best: any, current: any) => {
            const currentAvg = current.totalRating / current.count;
            const bestAvg = best.totalRating / best.count;
            return currentAvg > bestAvg ? current : best;
          }) as { name: string; totalRating: number; count: number };

          employeeOfMonth = {
            name: bestWorker.name,
            rating: bestWorker.totalRating / bestWorker.count,
            attendance: bestWorker.count,
          };
        }
      }

      setStats({
        activePersonnel,
        avgPerformance,
        checkedInToday,
        notCheckedInToday,
        topPerformer,
        monthlyOutsource,
        employeeOfMonth,
      });

      const { data: technicalRequests } = await supabase
        .from('technical_service_requests')
        .select(`
          asset_code,
          room_area,
          floor,
          technical_service_types(name),
          projects_greenco!inner(id)
        `)
        .in('project_id', projectIds);

      if (technicalRequests) {
        const assetServiceMap = new Map<string, { service_type: string; asset_code: string; count: number }>();
        const serviceLocationMap = new Map<string, { service_type: string; room_area: string; floor: string; count: number }>();

        technicalRequests.forEach((req: any) => {
          if (req.asset_code && req.technical_service_types?.name) {
            const key = `${req.technical_service_types.name}|${req.asset_code}`;
            const existing = assetServiceMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              assetServiceMap.set(key, {
                service_type: req.technical_service_types.name,
                asset_code: req.asset_code,
                count: 1,
              });
            }
          }

          if (req.room_area && req.technical_service_types?.name) {
            const key = `${req.technical_service_types.name}|${req.room_area}|${req.floor || ''}`;
            const existing = serviceLocationMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              serviceLocationMap.set(key, {
                service_type: req.technical_service_types.name,
                room_area: req.room_area,
                floor: req.floor || '-',
                count: 1,
              });
            }
          }
        });

        const allItems: ProblematicItem[] = [];

        assetServiceMap.forEach((item) => {
          allItems.push({
            type: 'asset',
            label: item.service_type,
            sublabel: `Varlık Kodu: ${item.asset_code}`,
            count: item.count,
          });
        });

        serviceLocationMap.forEach((loc) => {
          allItems.push({
            type: 'location',
            label: loc.service_type,
            sublabel: `${loc.room_area} - Kat: ${loc.floor}`,
            count: loc.count,
          });
        });

        const sortedItems = allItems
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        setProblematicItems(sortedItems);
      }
    } catch (error) {
      console.error('Dashboard yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Proje Yöneticisi Dashboard</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proje Yöneticisi Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.row}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Users size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats.activePersonnel}</Text>
            <Text style={styles.statLabel}>Aktif Personel</Text>
          </View>

          <View style={[styles.statCard, { flex: 1 }]}>
            <TrendingUp size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{stats.avgPerformance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Ort. Performans</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.attendanceCard, { flex: 1, backgroundColor: COLORS.successLight }]}>
            <CheckCircle size={24} color={COLORS.success} />
            <Text style={[styles.attendanceValue, { color: COLORS.success }]}>{stats.checkedInToday}</Text>
            <Text style={styles.attendanceLabel}>Giriş Yaptı</Text>
          </View>

          <View style={[styles.attendanceCard, { flex: 1, backgroundColor: COLORS.errorLight }]}>
            <XCircle size={24} color={COLORS.error} />
            <Text style={[styles.attendanceValue, { color: COLORS.error }]}>{stats.notCheckedInToday}</Text>
            <Text style={styles.attendanceLabel}>Giriş Yapmadı</Text>
          </View>
        </View>

        {stats.topPerformer && (
          <View style={styles.topPerformerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Award size={24} color={COLORS.warning} />
              <Text style={styles.topPerformerTitle}>En İyi Performans</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.topPerformerName}>{stats.topPerformer.name}</Text>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>{stats.topPerformer.rating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        )}

        {stats.employeeOfMonth && (
          <View style={styles.employeeOfMonthCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }}>
              <Text style={styles.employeeOfMonthBadge}>🌟</Text>
              <Text style={styles.employeeOfMonthTitle}>Ayın Personeli</Text>
            </View>
            <View style={styles.employeeOfMonthContent}>
              <View style={styles.employeeAvatar}>
                <Text style={styles.employeeAvatarText}>{stats.employeeOfMonth.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.employeeName}>{stats.employeeOfMonth.name}</Text>
                <View style={{ flexDirection: 'row', gap: 15, marginTop: 8 }}>
                  <View>
                    <Text style={styles.employeeStatLabel}>Performans</Text>
                    <Text style={styles.employeeStatValue}>⭐ {stats.employeeOfMonth.rating.toFixed(1)}</Text>
                  </View>
                  <View>
                    <Text style={styles.employeeStatLabel}>Devam</Text>
                    <Text style={styles.employeeStatValue}>📅 {stats.employeeOfMonth.attendance} gün</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.outsourceCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Calendar size={24} color={COLORS.primary} />
            <View>
              <Text style={styles.outsourceLabel}>Bu Ay Outsource Kullanımı</Text>
              <Text style={styles.outsourceValue}>{stats.monthlyOutsource} Personel</Text>
            </View>
          </View>
        </View>

        {problematicItems.length > 0 && (
          <View style={styles.technicalSection}>
            <Text style={styles.technicalTitle}>Sık Sorun Yaşanan Ekipman/Tesisatlar</Text>
            <View style={styles.topListCard}>
              {problematicItems.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.topListItem}>
                  <View style={styles.topListLeft}>
                    <View style={[styles.rankBadge, index === 0 && styles.rankBadgeFirst]}>
                      <Text style={[styles.rankText, index === 0 && styles.rankTextFirst]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={[styles.topListIcon, { backgroundColor: '#fee2e2' }]}>
                      {item.type === 'asset' ? (
                        <Package size={20} color="#dc2626" />
                      ) : (
                        <MapPin size={20} color="#dc2626" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topListLabel}>{item.label}</Text>
                      {item.sublabel && (
                        <Text style={styles.topListSubLabel}>{item.sublabel}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.topListBadge, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[styles.topListCount, { color: '#dc2626' }]}>{item.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Hızlı Erişim</Text>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/manager/unit-work-orders')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#dbeafe' }]}>
              <Package size={24} color="#3b82f6" />
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionLabel}>Birim Bazlı İş Emirleri</Text>
              <Text style={styles.quickActionSubLabel}>
                İş emirlerini görüntüle
              </Text>
            </View>
            <ArrowLeft size={20} color={COLORS.textLight} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, { marginTop: 10 }]}
            onPress={() => router.push('/manager/unit-invoices')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#fef3c7' }]}>
              <FileText size={24} color="#f59e0b" />
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionLabel}>Birim Bazlı Hakedişler</Text>
              <Text style={styles.quickActionSubLabel}>
                Hakedişleri incele ve yorum yap
              </Text>
            </View>
            <ArrowLeft size={20} color={COLORS.textLight} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, { marginTop: 10 }]}
            onPress={() => router.push('/manager/completed-services')}
          >
            <View style={styles.quickActionIcon}>
              <CheckCircle size={24} color={COLORS.primary} />
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionLabel}>Tamamlanan Hizmetler</Text>
              <Text style={styles.quickActionSubLabel}>
                Teknik servisleri değerlendirin
              </Text>
            </View>
            <ArrowLeft size={20} color={COLORS.textLight} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <GreencoLogo size="small" variant="light" />
        </View>
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
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 10,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 5,
    textAlign: 'center',
  },
  attendanceCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  attendanceValue: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 10,
  },
  attendanceLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 5,
    textAlign: 'center',
  },
  topPerformerCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topPerformerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  topPerformerName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },
  ratingBadge: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.warning,
  },
  outsourceCard: {
    backgroundColor: COLORS.primaryLight,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  outsourceLabel: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  outsourceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 5,
  },
  employeeOfMonthCard: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  employeeOfMonthBadge: {
    fontSize: 32,
  },
  employeeOfMonthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  employeeOfMonthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  employeeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  employeeStatLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  employeeStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 2,
  },
  technicalSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  technicalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  topListCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeFirst: {
    backgroundColor: '#fef3c7',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  rankTextFirst: {
    color: '#f59e0b',
  },
  topListIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topListLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },
  topListSubLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  topListBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  topListCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  quickActionsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  quickActionButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  quickActionSubLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
});
