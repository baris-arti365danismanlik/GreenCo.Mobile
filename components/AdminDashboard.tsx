import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Users, DollarSign, Star, Smile, Briefcase, TrendingUp, Award, ClipboardList, FileText } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import StatCard from './StatCard';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Kadro360Logo } from './Kadro360Logo';

type DashboardStats = {
  totalHeadcount: number;
  totalRevenue: number;
  avgPerformance: number;
  customerSatisfaction: number;
  activeProjects: number;
  monthlyGrowth: number;
  topProject: { name: string; personnelCount: number } | null;
  thisMonthRevenue: number;
  pendingWorkOrders: number;
  pendingInvoices: number;
  unitBasedRevenue: number;
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalHeadcount: 0,
    totalRevenue: 0,
    avgPerformance: 0,
    customerSatisfaction: 0,
    activeProjects: 0,
    monthlyGrowth: 0,
    topProject: null,
    thisMonthRevenue: 0,
    pendingWorkOrders: 0,
    pendingInvoices: 0,
    unitBasedRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

      // Total headcount (active personnel)
      const { count: headcount } = await supabase
        .from('project_assignments')
        .select('*, projects_greenco!inner(*)', { count: 'exact', head: true })
        .eq('projects_greenco.is_active', true);

      // Total revenue (approved invoices)
      const { data: approvedInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('status', 'approved');

      const totalRevenue = approvedInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      // This month revenue
      const { data: thisMonthInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('status', 'approved')
        .gte('created_at', startOfMonth);

      const thisMonthRev = thisMonthInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      // Last month revenue for growth calculation
      const { data: lastMonthInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('status', 'approved')
        .gte('created_at', startOfLastMonth)
        .lte('created_at', endOfLastMonth);

      const lastMonthRev = lastMonthInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const growth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

      // Average performance
      const { data: performanceData } = await supabase
        .from('attendance_records')
        .select('performance_rating')
        .not('performance_rating', 'is', null);

      const ratings = performanceData?.filter(p => p.performance_rating) || [];
      const avgPerf = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r.performance_rating || 0), 0) / ratings.length
        : 0;

      // Customer satisfaction (average from timesheets feedback)
      const { data: timesheets } = await supabase
        .from('timesheet_periods')
        .select('client_satisfaction_rating')
        .not('client_satisfaction_rating', 'is', null);

      const satisfactionRatings = timesheets?.filter(t => t.client_satisfaction_rating) || [];
      const avgSatisfaction = satisfactionRatings.length > 0
        ? satisfactionRatings.reduce((sum, t) => sum + (t.client_satisfaction_rating || 0), 0) / satisfactionRatings.length
        : 0;

      // Active projects
      const { count: projectCount } = await supabase
        .from('projects_greenco')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Top project by personnel count
      const { data: projectStats } = await supabase
        .from('project_assignments')
        .select('project_id, projects_greenco!inner(name, is_active)')
        .eq('projects_greenco.is_active', true);

      const projectCounts = new Map<string, { name: string; count: number }>();
      projectStats?.forEach(assignment => {
        const projectId = assignment.project_id;
        const projectName = (assignment.projects_greenco as any)?.name || 'Bilinmiyor';
        const existing = projectCounts.get(projectId) || { name: projectName, count: 0 };
        existing.count += 1;
        projectCounts.set(projectId, existing);
      });

      const topProj = Array.from(projectCounts.values())
        .sort((a, b) => b.count - a.count)[0] || null;

      // Unit-based work orders pending approval
      const { count: pendingWorkOrdersCount } = await supabase
        .from('unit_based_work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Unit-based invoices pending manager review
      const { count: pendingInvoicesCount } = await supabase
        .from('unit_based_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_manager_review');

      // Unit-based revenue (operations approved invoices)
      const { data: unitInvoices } = await supabase
        .from('unit_based_invoices')
        .select('final_amount')
        .eq('status', 'operations_approved');

      const unitRevenue = unitInvoices?.reduce((sum, inv) => sum + (inv.final_amount || 0), 0) || 0;

      setStats({
        totalHeadcount: headcount || 0,
        totalRevenue,
        avgPerformance: avgPerf,
        customerSatisfaction: avgSatisfaction,
        activeProjects: projectCount || 0,
        monthlyGrowth: growth,
        topProject: topProj ? { name: topProj.name, personnelCount: topProj.count } : null,
        thisMonthRevenue: thisMonthRev,
        pendingWorkOrders: pendingWorkOrdersCount || 0,
        pendingInvoices: pendingInvoicesCount || 0,
        unitBasedRevenue: unitRevenue,
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
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
          <Text style={styles.name}>
            <Text style={{ color: '#2477AD', fontWeight: '900' }}>KADRO</Text>
            <Text style={{ color: '#1B96D1', fontWeight: '900' }}>360</Text>
          </Text>
        </View>
        <Text style={styles.greeting}>Merhaba,</Text>
        <Text style={styles.name}>{profile?.full_name}</Text>
        <Text style={styles.role}>Yönetici</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Temel Metrikler</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="Toplam Headcount"
              value={stats.totalHeadcount}
              subtitle="Aktif personel"
              icon={Users}
              iconColor={COLORS.primary}
              iconBg="#dbeafe"
              onPress={() => router.push('/admin/personnel')}
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Aktif Proje"
              value={stats.activeProjects}
              icon={Briefcase}
              iconColor="#8b5cf6"
              iconBg="#ede9fe"
              onPress={() => router.push('/admin/projects')}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Finansal</Text>
        <View style={styles.grid}>
          <View style={styles.gridFull}>
            <StatCard
              title="Toplam Gelir"
              value={formatCurrency(stats.totalRevenue)}
              subtitle="Onaylanan hakediş"
              icon={DollarSign}
              iconColor={COLORS.success}
              iconBg="#d1fae5"
              onPress={() => router.push('/admin/invoices')}
            />
          </View>
          <View style={styles.gridFull}>
            <StatCard
              title="Bu Ay Gelir"
              value={formatCurrency(stats.thisMonthRevenue)}
              subtitle={`${stats.monthlyGrowth >= 0 ? '+' : ''}${stats.monthlyGrowth.toFixed(1)}% büyüme`}
              icon={TrendingUp}
              iconColor={stats.monthlyGrowth >= 0 ? COLORS.success : COLORS.error}
              iconBg={stats.monthlyGrowth >= 0 ? '#d1fae5' : '#fee2e2'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Birim Bazlı İş Sistemi</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="Bekleyen İş Emri"
              value={stats.pendingWorkOrders}
              subtitle="Onay bekliyor"
              icon={ClipboardList}
              iconColor="#f59e0b"
              iconBg="#fef3c7"
              onPress={() => router.push('/admin/unit-work-orders')}
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Bekleyen Hakediş"
              value={stats.pendingInvoices}
              subtitle="İnceleme bekliyor"
              icon={FileText}
              iconColor="#3b82f6"
              iconBg="#dbeafe"
              onPress={() => router.push('/admin/unit-invoices')}
            />
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.gridFull}>
            <StatCard
              title="Birim Bazlı Gelir"
              value={formatCurrency(stats.unitBasedRevenue)}
              subtitle="Onaylanan hakediş"
              icon={DollarSign}
              iconColor="#10b981"
              iconBg="#d1fae5"
              onPress={() => router.push('/admin/unit-invoices')}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kalite Metrikleri</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="Personel Performansı"
              value={stats.avgPerformance.toFixed(1)}
              subtitle="Ortalama puan"
              icon={Star}
              iconColor="#f59e0b"
              iconBg="#fef3c7"
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Müşteri Memnuniyeti"
              value={stats.customerSatisfaction.toFixed(1)}
              subtitle="Ortalama puan"
              icon={Smile}
              iconColor="#10b981"
              iconBg="#d1fae5"
            />
          </View>
        </View>
      </View>

      {stats.topProject && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Öne Çıkan Proje</Text>
          <View style={styles.topProjectCard}>
            <View style={[styles.topProjectIcon, { backgroundColor: '#fef3c7' }]}>
              <Award size={24} color="#f59e0b" />
            </View>
            <View style={styles.topProjectInfo}>
              <Text style={styles.topProjectLabel}>En Çok Personel</Text>
              <Text style={styles.topProjectName}>{stats.topProject.name}</Text>
              <Text style={styles.topProjectCount}>
                {stats.topProject.personnelCount} aktif personel
              </Text>
            </View>
          </View>
        </View>
      )}
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
  gridFull: {
    width: '100%',
  },
  topProjectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  topProjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProjectInfo: {
    flex: 1,
  },
  topProjectLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  topProjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  topProjectCount: {
    fontSize: 14,
    color: '#6b7280',
  },
});
