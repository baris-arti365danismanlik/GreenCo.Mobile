import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Users, UserPlus, ClipboardList, CheckCircle, XCircle, Hourglass, FileText, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { GreencoLogo } from '@/components/GreencoLogo';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type DashboardStats = {
  finalizedInvoiceAmount: number;
  pendingInvoiceAmount: number;
  activeOutsourcePersonnel: number;
  newAssignmentsThisMonth: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  projectCosts: { projectName: string; cost: number }[];
};

export default function OperationsDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // TODO: Filter stats based on service_modules (personnel, technical)
  // Currently shows only personnel module stats

  const [stats, setStats] = useState<DashboardStats>({
    finalizedInvoiceAmount: 0,
    pendingInvoiceAmount: 0,
    activeOutsourcePersonnel: 0,
    newAssignmentsThisMonth: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    projectCosts: [],
  });

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, status');

      const finalizedInvoiceAmount = invoices
        ?.filter(inv => inv.status === 'approved')
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      const pendingInvoiceAmount = invoices
        ?.filter(inv => inv.status === 'submitted')
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('worker_id, profiles!inner(personnel_type), created_at')
        .is('removed_at', null);

      const activeOutsourcePersonnel = assignments?.filter(a => {
        const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return profile?.personnel_type === 'outsource';
      }).length || 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const newAssignmentsThisMonth = assignments?.filter(a => {
        const createdDate = new Date(a.created_at);
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
      }).length || 0;

      const { data: requests } = await supabase
        .from('personnel_requests')
        .select('status');

      const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0;
      const approvedRequests = requests?.filter(r => r.status === 'approved' || r.status === 'awaiting_assignment').length || 0;
      const rejectedRequests = requests?.filter(r => r.status === 'rejected').length || 0;

      const { data: projectInvoices } = await supabase
        .from('invoices')
        .select('total_amount, timesheets!inner(project_id, projects_greenco!inner(name))')
        .eq('status', 'approved');

      const projectCostsMap = projectInvoices?.reduce((acc: any, inv: any) => {
        const projectName = inv.timesheets?.projects_greenco?.name;
        if (projectName) {
          acc[projectName] = (acc[projectName] || 0) + (inv.total_amount || 0);
        }
        return acc;
      }, {});

      const projectCosts = Object.entries(projectCostsMap || {})
        .map(([projectName, cost]) => ({
          projectName,
          cost: cost as number,
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

      setStats({
        finalizedInvoiceAmount,
        pendingInvoiceAmount,
        activeOutsourcePersonnel,
        newAssignmentsThisMonth,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        projectCosts,
      });
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
          <Text style={styles.headerTitle}>Operasyon Dashboard</Text>
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
        <Text style={styles.headerTitle}>Operasyon Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.invoiceCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <DollarSign size={28} color={COLORS.success} />
            <Text style={styles.invoiceTitle}>Hakediş Durumu</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceLabel}>Kesinleşen</Text>
              <Text style={styles.invoiceValue}>₺{stats.finalizedInvoiceAmount.toLocaleString('tr-TR')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceLabel}>Bekleyen</Text>
              <Text style={[styles.invoiceValue, { color: COLORS.warning }]}>
                ₺{stats.pendingInvoiceAmount.toLocaleString('tr-TR')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Users size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats.activeOutsourcePersonnel}</Text>
            <Text style={styles.statLabel}>Aktif Outsource</Text>
          </View>

          <View style={[styles.statCard, { flex: 1 }]}>
            <UserPlus size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{stats.newAssignmentsThisMonth}</Text>
            <Text style={styles.statLabel}>Bu Ay Atamalar</Text>
          </View>
        </View>

        <View style={styles.requestsCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <ClipboardList size={24} color={COLORS.secondary} />
            <Text style={styles.requestsTitle}>Personel Talep Durumları</Text>
          </View>

          <View style={styles.requestRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Hourglass size={20} color={COLORS.warning} />
              <Text style={styles.requestLabel}>Bekleyen</Text>
            </View>
            <View style={[styles.requestBadge, { backgroundColor: COLORS.warningLight }]}>
              <Text style={[styles.requestCount, { color: COLORS.warning }]}>{stats.pendingRequests}</Text>
            </View>
          </View>

          <View style={styles.requestRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={20} color={COLORS.success} />
              <Text style={styles.requestLabel}>Onaylanan</Text>
            </View>
            <View style={[styles.requestBadge, { backgroundColor: COLORS.successLight }]}>
              <Text style={[styles.requestCount, { color: COLORS.success }]}>{stats.approvedRequests}</Text>
            </View>
          </View>

          <View style={styles.requestRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <XCircle size={20} color={COLORS.error} />
              <Text style={styles.requestLabel}>Reddedilen</Text>
            </View>
            <View style={[styles.requestBadge, { backgroundColor: COLORS.errorLight }]}>
              <Text style={[styles.requestCount, { color: COLORS.error }]}>{stats.rejectedRequests}</Text>
            </View>
          </View>
        </View>

        {stats.projectCosts.length > 0 && (
          <View style={styles.projectCostsCard}>
            <Text style={styles.projectCostsTitle}>Proje Bazlı Maliyet Analizi</Text>
            <Text style={styles.projectCostsSubtitle}>Top 5 Proje</Text>
            <View style={styles.projectCostsList}>
              {stats.projectCosts.map((project, index) => {
                const maxCost = stats.projectCosts[0].cost;
                const percentage = (project.cost / maxCost) * 100;
                return (
                  <View key={index} style={styles.projectCostItem}>
                    <View style={styles.projectCostHeader}>
                      <Text style={styles.projectCostName}>{project.projectName}</Text>
                      <Text style={styles.projectCostAmount}>₺{project.cost.toLocaleString('tr-TR')}</Text>
                    </View>
                    <View style={styles.projectCostBarContainer}>
                      <View style={[styles.projectCostBar, { width: `${percentage}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}


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
  invoiceCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  invoiceLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 5,
  },
  invoiceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.success,
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
  requestsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  requestLabel: {
    fontSize: 15,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  requestBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  requestCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  projectCostsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  projectCostsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 5,
  },
  projectCostsSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 15,
  },
  projectCostsList: {
    gap: 15,
  },
  projectCostItem: {
    gap: 8,
  },
  projectCostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectCostName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },
  projectCostAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  projectCostBarContainer: {
    height: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  projectCostBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  quickActionsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionInfo: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  quickActionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
