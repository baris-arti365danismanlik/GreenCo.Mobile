import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, Users, FolderKanban, DollarSign, Star, Award, Filter, X, Check, ClipboardList, FileText, ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { GreencoLogo } from '@/components/GreencoLogo';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type DashboardStats = {
  totalHeadcount: number;
  activeProjects: number;
  totalRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  avgPerformance: number;
  customerSatisfaction: number;
  topProject: { name: string; personnelCount: number } | null;
  topRevenueProject: { name: string; revenue: number } | null;
  monthlyRevenueData: { month: string; revenue: number }[];
};

export default function AdminDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalHeadcount: 0,
    activeProjects: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    avgPerformance: 0,
    customerSatisfaction: 0,
    topProject: null,
    topRevenueProject: null,
    monthlyRevenueData: [],
  });

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    loadFilters();
    loadDashboardStats();
  }, []);

  useEffect(() => {
    loadDashboardStats();
  }, [selectedCompanyId, selectedProjectId]);

  const loadFilters = async () => {
    try {
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      const { data: projectsData } = await supabase
        .from('projects_greenco')
        .select('id, name, company_id')
        .eq('is_active', true)
        .order('name');

      setCompanies(companiesData || []);
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Filtre yükleme hatası:', error);
    }
  };

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      const { count: headcount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'personnel');

      const { count: projectCount } = await supabase
        .from('projects_greenco')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      let invoicesQuery = supabase
        .from('invoices')
        .select('total_amount, created_at, status, timesheets!inner(project_id, projects_greenco!inner(id, name, company_id))')
        .eq('status', 'approved');

      if (selectedProjectId) {
        invoicesQuery = invoicesQuery.eq('timesheets.project_id', selectedProjectId);
      } else if (selectedCompanyId) {
        invoicesQuery = invoicesQuery.eq('timesheets.projects_greenco.company_id', selectedCompanyId);
      }

      const { data: invoices } = await invoicesQuery;

      const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = invoices?.filter(inv => {
        const invDate = new Date(inv.created_at);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      }).reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lastMonthRevenue = invoices?.filter(inv => {
        const invDate = new Date(inv.created_at);
        return invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear;
      }).reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      const revenueGrowth = lastMonthRevenue > 0
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('performance_rating');

      const performanceRatings = attendanceRecords
        ?.filter(r => r.performance_rating)
        .map(r => r.performance_rating) || [];

      const avgPerformance = performanceRatings.length > 0
        ? performanceRatings.reduce((sum, rating) => sum + rating, 0) / performanceRatings.length
        : 0;

      const { data: projectPersonnelCounts } = await supabase
        .from('project_assignments')
        .select('project_id, projects_greenco(name)')
        .eq('is_active', true);

      const projectCounts = projectPersonnelCounts?.reduce((acc: any, assignment: any) => {
        const projectName = assignment.projects_greenco?.name;
        if (projectName) {
          acc[projectName] = (acc[projectName] || 0) + 1;
        }
        return acc;
      }, {});

      let topProject = null;
      if (projectCounts) {
        const topProjectName = Object.keys(projectCounts).reduce((a, b) =>
          projectCounts[a] > projectCounts[b] ? a : b,
          Object.keys(projectCounts)[0]
        );
        topProject = {
          name: topProjectName,
          personnelCount: projectCounts[topProjectName],
        };
      }

      const { data: projectInvoices } = await supabase
        .from('invoices')
        .select('total_amount, timesheets!inner(project_id, projects_greenco!inner(name))')
        .eq('status', 'approved');

      const projectRevenues = projectInvoices?.reduce((acc: any, inv: any) => {
        const projectName = inv.timesheets?.projects_greenco?.name;
        if (projectName) {
          acc[projectName] = (acc[projectName] || 0) + (inv.total_amount || 0);
        }
        return acc;
      }, {});

      let topRevenueProject = null;
      if (projectRevenues && Object.keys(projectRevenues).length > 0) {
        const topRevProjectName = Object.keys(projectRevenues).reduce((a, b) =>
          projectRevenues[a] > projectRevenues[b] ? a : b
        );
        topRevenueProject = {
          name: topRevProjectName,
          revenue: projectRevenues[topRevProjectName],
        };
      }

      const monthlyRevenueData = [];
      const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.getMonth();
        const year = date.getFullYear();

        const monthRev = invoices?.filter(inv => {
          const invDate = new Date(inv.created_at);
          return invDate.getMonth() === month && invDate.getFullYear() === year;
        }).reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

        monthlyRevenueData.push({
          month: monthNames[month],
          revenue: monthRev,
        });
      }

      setStats({
        totalHeadcount: headcount || 0,
        activeProjects: projectCount || 0,
        totalRevenue,
        monthlyRevenue,
        revenueGrowth,
        avgPerformance,
        customerSatisfaction: 4.5,
        topProject,
        topRevenueProject,
        monthlyRevenueData,
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
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
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
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
          <Filter size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.row}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Users size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats.totalHeadcount}</Text>
            <Text style={styles.statLabel}>Toplam Headcount</Text>
          </View>

          <View style={[styles.statCard, { flex: 1 }]}>
            <FolderKanban size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{stats.activeProjects}</Text>
            <Text style={styles.statLabel}>Aktif Proje</Text>
          </View>
        </View>

        <View style={styles.revenueCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <DollarSign size={28} color={COLORS.warning} />
            <View>
              <Text style={styles.revenueLabel}>Toplam Gelir</Text>
              <Text style={styles.revenueValue}>₺{stats.totalRevenue.toLocaleString('tr-TR')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.monthlyCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.monthlyLabel}>Bu Ay Gelir</Text>
              <Text style={styles.monthlyValue}>₺{stats.monthlyRevenue.toLocaleString('tr-TR')}</Text>
            </View>
            <View style={[styles.growthBadge, stats.revenueGrowth >= 0 ? styles.growthPositive : styles.growthNegative]}>
              {stats.revenueGrowth >= 0 ? (
                <TrendingUp size={16} color={COLORS.success} />
              ) : (
                <TrendingDown size={16} color={COLORS.error} />
              )}
              <Text style={[styles.growthText, stats.revenueGrowth >= 0 ? styles.growthTextPositive : styles.growthTextNegative]}>
                {Math.abs(stats.revenueGrowth).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.metricCard, { flex: 1 }]}>
            <Award size={24} color={COLORS.primary} />
            <Text style={styles.metricValue}>{stats.avgPerformance.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Ort. Performans</Text>
          </View>

          <View style={[styles.metricCard, { flex: 1 }]}>
            <Star size={24} color={COLORS.warning} />
            <Text style={styles.metricValue}>{stats.customerSatisfaction.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Müşteri Memnuniyeti</Text>
          </View>
        </View>

        {stats.topRevenueProject && (
          <View style={styles.topRevenueCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <DollarSign size={24} color="#f59e0b" />
              <Text style={styles.topRevenueTitle}>🏆 En Verimli Proje</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.topRevenueName}>{stats.topRevenueProject.name}</Text>
              <View style={styles.topRevenueBadge}>
                <Text style={styles.topRevenueAmount}>₺{stats.topRevenueProject.revenue.toLocaleString('tr-TR')}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Son 6 Ay Hakediş Grafiği</Text>
          <View style={styles.chartContainer}>
            {stats.monthlyRevenueData.map((data, index) => {
              const maxRevenue = Math.max(...stats.monthlyRevenueData.map(d => d.revenue), 1);
              const height = (data.revenue / maxRevenue) * 120;
              return (
                <View key={index} style={styles.chartBar}>
                  <View style={styles.chartBarInner}>
                    <View style={[styles.chartBarFill, { height: height || 5 }]}>
                      <Text style={styles.chartBarValue}>
                        {data.revenue > 0 ? `₺${(data.revenue / 1000).toFixed(0)}k` : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.chartBarLabel}>{data.month}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {stats.topProject && (
          <View style={styles.topProjectCard}>
            <Text style={styles.topProjectTitle}>En Çok Personel Kullanan Proje</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <Text style={styles.topProjectName}>{stats.topProject.name}</Text>
              <View style={styles.topProjectBadge}>
                <Users size={16} color="white" />
                <Text style={styles.topProjectCount}>{stats.topProject.personnelCount}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.quickAccessCard}>
          <Text style={styles.quickAccessTitle}>Birim Bazlı İş Sistemi</Text>

          <TouchableOpacity
            style={styles.quickAccessButton}
            onPress={() => router.push('/admin/unit-work-orders')}
          >
            <View style={styles.quickAccessIcon}>
              <ClipboardList size={24} color={COLORS.primary} />
            </View>
            <View style={styles.quickAccessInfo}>
              <Text style={styles.quickAccessLabel}>İş Emirleri</Text>
              <Text style={styles.quickAccessSubtitle}>Onayla ve fiyatlandır</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAccessButton}
            onPress={() => router.push('/admin/unit-invoices')}
          >
            <View style={styles.quickAccessIcon}>
              <FileText size={24} color={COLORS.success} />
            </View>
            <View style={styles.quickAccessInfo}>
              <Text style={styles.quickAccessLabel}>Hakedişler</Text>
              <Text style={styles.quickAccessSubtitle}>Oluştur ve yönet</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAccessButton}
            onPress={() => router.push('/admin/create-unit-invoice')}
          >
            <View style={[styles.quickAccessIcon, { backgroundColor: '#fef3c7' }]}>
              <DollarSign size={24} color="#f59e0b" />
            </View>
            <View style={styles.quickAccessInfo}>
              <Text style={styles.quickAccessLabel}>Yeni Hakediş Oluştur</Text>
              <Text style={styles.quickAccessSubtitle}>İş emrinden hakediş çıkart</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <GreencoLogo size="small" variant="light" />
        </View>
      </ScrollView>

      <Modal visible={filterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtreler</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>Müşteri</Text>
              <TouchableOpacity
                style={[styles.filterItem, !selectedCompanyId && styles.filterItemActive]}
                onPress={() => {
                  setSelectedCompanyId(null);
                  setSelectedProjectId(null);
                }}
              >
                <Text style={[styles.filterItemText, !selectedCompanyId && styles.filterItemTextActive]}>
                  Tüm Müşteriler
                </Text>
                {!selectedCompanyId && <Check size={20} color={COLORS.primary} />}
              </TouchableOpacity>

              {companies.map((company) => (
                <TouchableOpacity
                  key={company.id}
                  style={[styles.filterItem, selectedCompanyId === company.id && styles.filterItemActive]}
                  onPress={() => {
                    setSelectedCompanyId(company.id);
                    setSelectedProjectId(null);
                  }}
                >
                  <Text style={[styles.filterItemText, selectedCompanyId === company.id && styles.filterItemTextActive]}>
                    {company.name}
                  </Text>
                  {selectedCompanyId === company.id && <Check size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>Proje</Text>
              <TouchableOpacity
                style={[styles.filterItem, !selectedProjectId && styles.filterItemActive]}
                onPress={() => setSelectedProjectId(null)}
              >
                <Text style={[styles.filterItemText, !selectedProjectId && styles.filterItemTextActive]}>
                  Tüm Projeler
                </Text>
                {!selectedProjectId && <Check size={20} color={COLORS.primary} />}
              </TouchableOpacity>

              {projects
                .filter(p => !selectedCompanyId || p.company_id === selectedCompanyId)
                .map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[styles.filterItem, selectedProjectId === project.id && styles.filterItemActive]}
                    onPress={() => setSelectedProjectId(project.id)}
                  >
                    <Text style={[styles.filterItemText, selectedProjectId === project.id && styles.filterItemTextActive]}>
                      {project.name}
                    </Text>
                    {selectedProjectId === project.id && <Check size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyButtonText}>Uygula</Text>
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
  revenueCard: {
    backgroundColor: COLORS.warningLight,
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
  },
  revenueLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  revenueValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 5,
  },
  monthlyCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthlyLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  monthlyValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 5,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  growthPositive: {
    backgroundColor: COLORS.successLight,
  },
  growthNegative: {
    backgroundColor: COLORS.errorLight,
  },
  growthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  growthTextPositive: {
    color: COLORS.success,
  },
  growthTextNegative: {
    color: COLORS.error,
  },
  metricCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 10,
  },
  metricLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 5,
    textAlign: 'center',
  },
  topProjectCard: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  topProjectTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  topProjectName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    flex: 1,
  },
  topProjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  topProjectCount: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  topRevenueCard: {
    backgroundColor: '#fff7ed',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  topRevenueTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
  },
  topRevenueName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },
  topRevenueBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  topRevenueAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  chartCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 15,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarInner: {
    width: '80%',
    height: 120,
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 5,
  },
  chartBarValue: {
    fontSize: 9,
    fontWeight: '700',
    color: 'white',
  },
  chartBarLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 8,
    fontWeight: '600',
  },
  quickAccessCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickAccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  quickAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickAccessIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickAccessInfo: {
    flex: 1,
  },
  quickAccessLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 2,
  },
  quickAccessSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 10,
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    marginBottom: 8,
  },
  filterItemActive: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  filterItemText: {
    fontSize: 15,
    color: COLORS.secondary,
  },
  filterItemTextActive: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
});
