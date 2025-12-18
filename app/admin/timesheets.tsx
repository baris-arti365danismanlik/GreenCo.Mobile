import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type TimesheetPeriod = {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'pending_manager' | 'approved_manager' | 'rejected_manager' | 'final_approved';
  total_hours: number;
  total_personnel: number;
  created_at: string;
  rejection_reason?: string;
  project: { name: string };
};

export default function TimesheetsScreen() {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<TimesheetPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [approving, setApproving] = useState<string | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState<string | null>(null);

  useEffect(() => {
    loadTimesheets();
  }, []);

  const loadTimesheets = async () => {
    try {
      const { data, error } = await supabase
        .from('timesheet_periods')
        .select(`
          *,
          projects_greenco!inner (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        ...item,
        project: { name: item.projects_greenco?.name }
      })) || [];

      setTimesheets(formattedData);
    } catch (error) {
      console.error('Puantaj yükleme hatası:', error);
      Alert.alert('Hata', 'Puantajlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTimesheets = () => {
    if (filter === 'all') return timesheets;
    if (filter === 'pending') return timesheets.filter(t => t.status === 'pending_manager');
    if (filter === 'approved') return timesheets.filter(t => ['approved_manager', 'final_approved'].includes(t.status));
    if (filter === 'rejected') return timesheets.filter(t => t.status === 'rejected_manager');
    return timesheets;
  };

  const handleFinalApproval = async (timesheetId: string) => {
    setSelectedTimesheetId(timesheetId);
    setConfirmModalVisible(true);
  };

  const performFinalApproval = async () => {
    if (!selectedTimesheetId) return;

    setApproving(selectedTimesheetId);
    setConfirmModalVisible(false);

    try {
      const { error } = await supabase
        .from('timesheet_periods')
        .update({ status: 'final_approved' })
        .eq('id', selectedTimesheetId);

      if (error) throw error;

      Alert.alert('Başarılı', 'Puantaj kesinleştirildi');
      await loadTimesheets();
    } catch (error: any) {
      console.error('Final onay hatası:', error);
      Alert.alert('Hata', error.message || 'İşlem başarısız');
    } finally {
      setApproving(null);
      setSelectedTimesheetId(null);
    }
  };

  const handleResubmit = async (timesheetId: string) => {
    setResubmitting(timesheetId);
    try {
      const { error } = await supabase
        .from('timesheet_periods')
        .update({
          status: 'pending_manager',
          rejection_reason: null,
          manager_rejected_at: null,
        })
        .eq('id', timesheetId);

      if (error) throw error;

      Alert.alert('Başarılı', 'Puantaj tekrar proje müdürüne gönderildi');
      await loadTimesheets();
    } catch (error: any) {
      console.error('Tekrar gönderme hatası:', error);
      Alert.alert('Hata', error.message || 'İşlem başarısız');
    } finally {
      setResubmitting(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending_manager':
        return { label: 'Onay Bekliyor', color: COLORS.warning, Icon: Clock };
      case 'approved_manager':
        return { label: 'Onaylandı', color: COLORS.success, Icon: CheckCircle };
      case 'rejected_manager':
        return { label: 'Reddedildi', color: COLORS.danger, Icon: XCircle };
      case 'final_approved':
        return { label: 'Kesinleşti', color: COLORS.primary, Icon: CheckCircle };
      default:
        return { label: 'Taslak', color: COLORS.textLight, Icon: AlertCircle };
    }
  };

  const filteredTimesheets = getFilteredTimesheets();

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
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Bekliyor ({timesheets.filter(t => t.status === 'pending_manager').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'approved' && styles.filterButtonActive]}
          onPress={() => setFilter('approved')}
        >
          <Text style={[styles.filterText, filter === 'approved' && styles.filterTextActive]}>
            Onaylı ({timesheets.filter(t => ['approved_manager', 'final_approved'].includes(t.status)).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'rejected' && styles.filterButtonActive]}
          onPress={() => setFilter('rejected')}
        >
          <Text style={[styles.filterText, filter === 'rejected' && styles.filterTextActive]}>
            Red ({timesheets.filter(t => t.status === 'rejected_manager').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.emptyText}>Yükleniyor...</Text>
        ) : filteredTimesheets.length === 0 ? (
          <Text style={styles.emptyText}>Puantaj bulunamadı</Text>
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

                {timesheet.status === 'rejected_manager' && timesheet.rejection_reason && (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionLabel}>Red Nedeni:</Text>
                    <Text style={styles.rejectionText}>{timesheet.rejection_reason}</Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.detailButton}
                    onPress={() => router.push(`/admin/timesheet-detail?id=${timesheet.id}`)}
                  >
                    <Text style={styles.detailButtonText}>Detayları Gör</Text>
                  </TouchableOpacity>

                  {timesheet.status === 'approved_manager' && (
                    <TouchableOpacity
                      style={[styles.approveButton, approving === timesheet.id && { opacity: 0.5 }]}
                      onPress={() => handleFinalApproval(timesheet.id)}
                      disabled={approving === timesheet.id}
                    >
                      <CheckCircle size={16} color="white" />
                      <Text style={styles.approveButtonText}>
                        {approving === timesheet.id ? 'Onaylanıyor...' : 'Kesinleştir'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {timesheet.status === 'rejected_manager' && (
                    <TouchableOpacity
                      style={[styles.resubmitButton, resubmitting === timesheet.id && { opacity: 0.5 }]}
                      onPress={() => handleResubmit(timesheet.id)}
                      disabled={resubmitting === timesheet.id}
                    >
                      <RefreshCw size={16} color={COLORS.warning} />
                      <Text style={styles.resubmitButtonText}>
                        {resubmitting === timesheet.id ? 'Gönderiliyor...' : 'Tekrar Gönder'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setConfirmModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Final Onay</Text>
            <Text style={styles.confirmMessage}>
              Bu puantajı kesinleştirmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setConfirmModalVisible(false);
                  setSelectedTimesheetId(null);
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={performFinalApproval}
              >
                <Text style={styles.confirmButtonText}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
  emptyText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 40,
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
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
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
    color: COLORS.text,
  },
  timesheetStats: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.success,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  rejectionBox: {
    backgroundColor: COLORS.danger + '10',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.danger,
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  resubmitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.warning + '20',
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  resubmitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
