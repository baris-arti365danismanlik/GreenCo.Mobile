import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { DollarSign, Users, TrendingUp, CheckCircle, Clock, AlertCircle, ClipboardList, FileText } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import StatCard from './StatCard';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { GreencoLogo } from './GreencoLogo';

type DashboardStats = {
  totalApprovedInvoices: number;
  totalOutsourcePersonnel: number;
  monthlyOutsource: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  pendingInvoiceAmount: number;
  myWorkOrders: number;
  pendingUnitInvoices: number;
};

export default function OperationsDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalApprovedInvoices: 0,
    totalOutsourcePersonnel: 0,
    monthlyOutsource: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    pendingInvoiceAmount: 0,
    myWorkOrders: 0,
    pendingUnitInvoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Total approved invoices amount
      const { data: approvedInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('status', 'approved');

      const totalApproved = approvedInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      // Pending invoices amount
      const { data: pendingInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .in('status', ['draft', 'submitted']);

      const totalPending = pendingInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      // Total outsource personnel (active assignments)
      const { count: outsourceCount } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Monthly outsource
      const { count: monthlyCount } = await supabase
        .from('project_assignments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth);

      // Personnel requests stats
      const { data: requests } = await supabase
        .from('personnel_requests')
        .select('status');

      const pending = requests?.filter(r => r.status === 'pending').length || 0;
      const approved = requests?.filter(r => r.status === 'approved').length || 0;
      const rejected = requests?.filter(r => r.status === 'rejected').length || 0;

      // My work orders
      const { data: userData } = await supabase.auth.getUser();
      const { count: workOrdersCount } = await supabase
        .from('unit_based_work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userData.user?.id);

      // Unit-based invoices pending operations approval
      const { count: pendingUnitInvoicesCount } = await supabase
        .from('unit_based_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_operations_approval');

      setStats({
        totalApprovedInvoices: totalApproved,
        totalOutsourcePersonnel: outsourceCount || 0,
        monthlyOutsource: monthlyCount || 0,
        pendingRequests: pending,
        approvedRequests: approved,
        rejectedRequests: rejected,
        pendingInvoiceAmount: totalPending,
        myWorkOrders: workOrdersCount || 0,
        pendingUnitInvoices: pendingUnitInvoicesCount || 0,
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
          <GreencoLogo size="small" variant="light" />
        </View>
        <Text style={styles.greeting}>Merhaba,</Text>
        <Text style={styles.name}>{profile?.full_name}</Text>
        <Text style={styles.role}>Operasyon Yöneticisi</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Finansal Durum</Text>
        <View style={styles.grid}>
          <View style={styles.gridFull}>
            <StatCard
              title="Kesinleşen Hakediş"
              value={formatCurrency(stats.totalApprovedInvoices)}
              subtitle="Onaylanan toplam"
              icon={DollarSign}
              iconColor={COLORS.success}
              iconBg="#d1fae5"
              onPress={() => router.push('/operations/invoices')}
            />
          </View>
          <View style={styles.gridFull}>
            <StatCard
              title="Bekleyen Hakediş"
              value={formatCurrency(stats.pendingInvoiceAmount)}
              subtitle="Onay bekliyor"
              icon={Clock}
              iconColor="#f59e0b"
              iconBg="#fef3c7"
              onPress={() => router.push('/operations/invoices')}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Outsource Kullanımı</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="Aktif Personel"
              value={stats.totalOutsourcePersonnel}
              subtitle="Toplam"
              icon={Users}
              iconColor={COLORS.primary}
              iconBg="#dbeafe"
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Bu Ay"
              value={stats.monthlyOutsource}
              subtitle="Yeni atama"
              icon={TrendingUp}
              iconColor="#8b5cf6"
              iconBg="#ede9fe"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Birim Bazlı İş Sistemi</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatCard
              title="İş Emirlerim"
              value={stats.myWorkOrders}
              subtitle="Oluşturuldu"
              icon={ClipboardList}
              iconColor="#8b5cf6"
              iconBg="#ede9fe"
              onPress={() => router.push('/operations/unit-work-orders')}
            />
          </View>
          <View style={styles.gridItem}>
            <StatCard
              title="Onayım Bekliyor"
              value={stats.pendingUnitInvoices}
              subtitle="Hakediş"
              icon={FileText}
              iconColor="#f59e0b"
              iconBg="#fef3c7"
              onPress={() => router.push('/operations/unit-invoices')}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personel Talepleri</Text>
        <View style={styles.requestCard}>
          <View style={styles.requestRow}>
            <View style={[styles.requestDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.requestLabel}>Bekleyen</Text>
            <Text style={styles.requestValue}>{stats.pendingRequests}</Text>
          </View>
          <View style={styles.requestRow}>
            <View style={[styles.requestDot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.requestLabel}>Onaylanan</Text>
            <Text style={styles.requestValue}>{stats.approvedRequests}</Text>
          </View>
          <View style={styles.requestRow}>
            <View style={[styles.requestDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.requestLabel}>Reddedilen</Text>
            <Text style={styles.requestValue}>{stats.rejectedRequests}</Text>
          </View>
        </View>

        {stats.pendingRequests > 0 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/requests')}
          >
            <AlertCircle size={20} color={COLORS.primary} />
            <Text style={styles.actionButtonText}>
              {stats.pendingRequests} talep onay bekliyor
            </Text>
          </TouchableOpacity>
        )}
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
  gridFull: {
    width: '100%',
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  requestLabel: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  requestValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
