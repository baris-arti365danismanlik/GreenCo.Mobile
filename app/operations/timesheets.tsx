import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, CheckCircle, FileText, AlertCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type TimesheetPeriod = {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_hours: number;
  total_personnel: number;
  invoice_created_at?: string;
  project: { name: string };
};

export default function OperationsTimesheetsScreen() {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<TimesheetPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'completed'>('ready');

  useEffect(() => {
    loadTimesheets();
  }, []);

  const loadTimesheets = async () => {
    try {
      console.log('Puantaj yükleniyor...');
      const { data, error } = await supabase
        .from('timesheet_periods')
        .select(`
          *,
          projects_greenco!inner (
            name
          )
        `)
        .in('status', ['final_approved', 'invoice_pending', 'invoice_completed'])
        .order('created_at', { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const formattedData = data?.map(item => ({
        ...item,
        project: { name: item.projects_greenco?.name }
      })) || [];

      console.log('Puantaj sayısı:', formattedData.length);
      setTimesheets(formattedData);
    } catch (error: any) {
      console.error('Puantaj yükleme hatası:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTimesheets = () => {
    if (filter === 'ready') {
      return timesheets.filter(t => t.status === 'final_approved');
    }
    if (filter === 'pending') {
      return timesheets.filter(t => t.status === 'invoice_pending');
    }
    if (filter === 'completed') {
      return timesheets.filter(t => t.status === 'invoice_completed');
    }
    return timesheets;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'final_approved':
        return { label: 'Hakediş Bekliyor', color: COLORS.success, Icon: CheckCircle };
      case 'invoice_pending':
        return { label: 'Hakediş Oluşturuldu', color: COLORS.warning, Icon: Clock };
      case 'invoice_completed':
        return { label: 'Tamamlandı', color: COLORS.primary, Icon: CheckCircle };
      default:
        return { label: 'Bilinmiyor', color: COLORS.textLight, Icon: AlertCircle };
    }
  };

  const filteredTimesheets = getFilteredTimesheets();

  const readyCount = timesheets.filter(t => t.status === 'final_approved').length;
  const pendingCount = timesheets.filter(t => t.status === 'invoice_pending').length;
  const completedCount = timesheets.filter(t => t.status === 'invoice_completed').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Puantaj Dönemleri</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Tümü ({timesheets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'ready' && styles.filterButtonActive]}
          onPress={() => setFilter('ready')}
        >
          <Text style={[styles.filterText, filter === 'ready' && styles.filterTextActive]}>
            Hazır ({readyCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            İşlemde ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Tamamlanan ({completedCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : filteredTimesheets.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Puantaj bulunamadı</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'ready' && 'Hakediş oluşturmaya hazır puantaj bulunmuyor'}
              {filter === 'pending' && 'İşlemde olan hakediş bulunmuyor'}
              {filter === 'completed' && 'Tamamlanmış hakediş bulunmuyor'}
              {filter === 'all' && 'Henüz kesinleşmiş puantaj bulunmuyor'}
            </Text>
          </View>
        ) : (
          filteredTimesheets.map((timesheet) => {
            const statusConfig = getStatusConfig(timesheet.status);
            const StatusIcon = statusConfig.Icon;

            return (
              <View key={timesheet.id} style={styles.timesheetCard}>
                <View style={styles.timesheetHeader}>
                  <Text style={styles.projectName}>{timesheet.project?.name || 'Proje'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    <StatusIcon size={14} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.timesheetInfo}>
                  <Text style={styles.dateRange}>
                    {new Date(timesheet.period_start).toLocaleDateString('tr-TR')} -{' '}
                    {new Date(timesheet.period_end).toLocaleDateString('tr-TR')}
                  </Text>
                </View>

                <View style={styles.timesheetStats}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Toplam Saat</Text>
                    <Text style={styles.statValue}>{timesheet.total_hours || 0}h</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Personel</Text>
                    <Text style={styles.statValue}>{timesheet.total_personnel || 0}</Text>
                  </View>
                </View>

                {timesheet.invoice_created_at && (
                  <Text style={styles.invoiceDate}>
                    Hakediş: {new Date(timesheet.invoice_created_at).toLocaleDateString('tr-TR')}
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => router.push(`/operations/timesheet-detail?id=${timesheet.id}`)}
                >
                  <FileText size={16} color={COLORS.primary} />
                  <Text style={styles.detailButtonText}>Detayları Gör</Text>
                </TouchableOpacity>
              </View>
            );
          })
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
  filters: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  filterTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  timesheetCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timesheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timesheetInfo: {
    marginBottom: 12,
  },
  dateRange: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  timesheetStats: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  invoiceDate: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
