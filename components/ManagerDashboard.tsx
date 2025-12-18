import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Users, Star, CheckCircle, TrendingUp, UserCheck, UserX, Award, FileText } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import StatCard from './StatCard';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { GreencoLogo } from './GreencoLogo';

type DashboardStats = {
  activePersonnel: number;
  avgPerformance: number;
  checkedInToday: number;
  notCheckedInToday: number;
  topPerformer: { name: string; score: number } | null;
  lowPerformer: { name: string; score: number } | null;
  monthlyOutsource: number;
  pendingUnitInvoices: number;
};

export default function ManagerDashboard() {
  console.log('=== MANAGER DASHBOARD RENDERING ===');
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    activePersonnel: 0,
    avgPerformance: 0,
    checkedInToday: 0,
    notCheckedInToday: 0,
    topPerformer: null,
    lowPerformer: null,
    monthlyOutsource: 0,
    pendingUnitInvoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, [profile]);

  const loadStats = async () => {
    if (!profile?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Get projects managed by this PM
      const { data: projects } = await supabase
        .from('project_managers')
        .select('project_id')
        .eq('manager_id', profile.id);

      const projectIds = projects?.map(p => p.project_id) || [];

      if (projectIds.length === 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Active personnel count
      const { count: activeCount } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('is_active', true);

      // Checked in today
      const { data: todayAttendance } = await supabase
        .from('attendance_records')
        .select('worker_id')
        .in('project_id', projectIds)
        .gte('check_in_time', `${today}T00:00:00`)
        .not('check_in_time', 'is', null);

      const checkedInIds = new Set(todayAttendance?.map(a => a.worker_id) || []);

      // Get all active personnel
      const { data: allPersonnel } = await supabase
        .from('project_assignments')
        .select('worker_id')
        .in('project_id', projectIds)
        .eq('is_active', true);

      const notCheckedIn = (allPersonnel?.length || 0) - checkedInIds.size;

      // Average performance (from attendance records)
      const { data: performanceData } = await supabase
        .from('attendance_records')
        .select('performance_rating, worker_id, profiles!attendance_records_worker_id_fkey(full_name)')
        .in('project_id', projectIds)
        .not('performance_rating', 'is', null)
        .gte('check_in_time', startOfMonth);

      const ratings = performanceData?.filter(p => p.performance_rating) || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r.performance_rating || 0), 0) / ratings.length
        : 0;

      // Top and low performers
      const personnelScores = new Map<string, { name: string; total: number; count: number }>();

      performanceData?.forEach(record => {
        if (record.performance_rating && record.worker_id) {
          const existing = personnelScores.get(record.worker_id) || {
            name: (record.profiles as any)?.full_name || 'Bilinmiyor',
            total: 0,
            count: 0,
          };
          existing.total += record.performance_rating;
          existing.count += 1;
          personnelScores.set(record.worker_id, existing);
        }
      });

      const averages = Array.from(personnelScores.values())
        .map(p => ({ name: p.name, score: p.total / p.count }))
        .sort((a, b) => b.score - a.score);

      const topPerformer = averages[0] || null;
      const lowPerformer = averages[averages.length - 1] || null;

      // Monthly outsource usage
      const { count: monthlyCount } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .gte('created_at', startOfMonth);

      // Unit-based invoices pending manager review
      const { count: pendingInvoicesCount } = await supabase
        .from('unit_based_invoices')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('status', 'pending_manager_review');

      setStats({
        activePersonnel: activeCount || 0,
        avgPerformance: avgRating,
        checkedInToday: checkedInIds.size,
        notCheckedInToday: notCheckedIn,
        topPerformer,
        lowPerformer,
        monthlyOutsource: monthlyCount || 0,
        pendingUnitInvoices: pendingInvoicesCount || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.logoWrapper}>
          <GreencoLogo size="small" variant="light" />
        </View>
        <Text style={styles.greeting}>Merhaba,</Text>
        <Text style={styles.name}>{profile?.full_name}</Text>
        <Text style={styles.role}>Proje Yöneticisi</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Genel Bakış</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="Aktif Personel"
              value={stats.activePersonnel}
              icon={Users}
              iconColor={COLORS.primary}
              iconBg="#d1fae5"
              onPress={() => router.push('/(tabs)/personnel')}
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Ort. Performans"
              value={stats.avgPerformance.toFixed(1)}
              subtitle="5 üzerinden"
              icon={Star}
              iconColor="#f59e0b"
              iconBg="#fef3c7"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bugün</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="Giriş Yapan"
              value={stats.checkedInToday}
              icon={UserCheck}
              iconColor={COLORS.success}
              iconBg="#d1fae5"
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Giriş Yapmayan"
              value={stats.notCheckedInToday}
              icon={UserX}
              iconColor={COLORS.error}
              iconBg="#fee2e2"
            />
          </View>
        </View>
      </View>

      {(stats.topPerformer || stats.lowPerformer) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performans</Text>
          {stats.topPerformer && (
            <View style={styles.performerCard}>
              <View style={[styles.performerIcon, { backgroundColor: '#fef3c7' }]}>
                <Award size={20} color="#f59e0b" />
              </View>
              <View style={styles.performerInfo}>
                <Text style={styles.performerLabel}>En Yüksek Performans</Text>
                <Text style={styles.performerName}>{stats.topPerformer.name}</Text>
                <Text style={styles.performerScore}>⭐ {stats.topPerformer.score.toFixed(1)}/5</Text>
              </View>
            </View>
          )}
          {stats.lowPerformer && stats.lowPerformer !== stats.topPerformer && (
            <View style={[styles.performerCard, { marginTop: 12 }]}>
              <View style={[styles.performerIcon, { backgroundColor: '#fee2e2' }]}>
                <TrendingUp size={20} color="#ef4444" />
              </View>
              <View style={styles.performerInfo}>
                <Text style={styles.performerLabel}>Gelişim Alanı</Text>
                <Text style={styles.performerName}>{stats.lowPerformer.name}</Text>
                <Text style={styles.performerScore}>⭐ {stats.lowPerformer.score.toFixed(1)}/5</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bu Ay</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="Outsource Kullanımı"
              value={stats.monthlyOutsource}
              subtitle="Toplam atama"
              icon={TrendingUp}
              iconColor="#3b82f6"
              iconBg="#dbeafe"
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Yorumum Bekliyor"
              value={stats.pendingUnitInvoices}
              subtitle="Hakediş"
              icon={FileText}
              iconColor="#f59e0b"
              iconBg="#fef3c7"
              onPress={() => router.push('/manager/unit-invoices')}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  logoWrapper: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 16,
    color: '#6b7280',
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  role: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    minWidth: '45%',
  },
  performerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  performerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performerInfo: {
    flex: 1,
  },
  performerLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  performerScore: {
    fontSize: 14,
    color: '#6b7280',
  },
});
