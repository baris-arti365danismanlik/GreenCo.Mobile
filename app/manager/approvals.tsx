import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, Eye } from 'lucide-react-native';
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
  rejection_reason?: string;
  project: { name: string };
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

const calculateOvertimeInfo = (totalHours: number, workDays: number) => {
  const standardHours = workDays * 8;
  const overtime = totalHours - standardHours;
  const undertime = overtime < 0 ? Math.abs(overtime) : 0;
  const actualOvertime = overtime > 0 ? overtime : 0;

  return { standardHours, overtime: actualOvertime, undertime };
};

export default function ManagerApprovalsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [timesheets, setTimesheets] = useState<TimesheetPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<TimesheetPeriod | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    loadTimesheets();
  }, []);

  const loadTimesheets = async () => {
    try {
      if (!profile?.id) return;

      const { data: managerProjects } = await supabase
        .from('project_managers')
        .select('project_id')
        .eq('manager_id', profile.id);

      const projectIds = managerProjects?.map(mp => mp.project_id) || [];

      if (projectIds.length === 0) {
        setTimesheets([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('timesheet_periods')
        .select(`
          *,
          projects_greenco!inner (
            name
          )
        `)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        ...item,
        project: { name: item.projects_greenco?.name }
      })) || [];

      setTimesheets(formattedData);
    } catch (error) {
      console.error('Puantaj yükleme hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: Puantajlar yüklenemedi');
      } else {
        const Alert = require('react-native').Alert;
        Alert.alert('Hata', 'Puantajlar yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (timesheet: TimesheetPeriod) => {
    setSelectedTimesheet(timesheet);
    setApprovalNote('');
    setApproveModalVisible(true);
  };

  const performApproval = async (timesheetId: string, note?: string) => {
    console.log('performApproval başladı, timesheetId:', timesheetId, 'profile.id:', profile?.id);
    try {
      // Check for unrated personnel
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('worker_id, performance_rating')
        .eq('project_id', (timesheets.find(t => t.id === timesheetId)?.project_id || ''));

      if (attendanceError) throw attendanceError;

      // Get unique workers who have NO ratings at all
      const workerRatings = new Map<string, boolean>();
      attendanceData?.forEach(record => {
        const workerId = record.worker_id;
        if (!workerRatings.has(workerId)) {
          workerRatings.set(workerId, false);
        }
        if (record.performance_rating !== null) {
          workerRatings.set(workerId, true);
        }
      });

      const unratedPersonnelCount = Array.from(workerRatings.values()).filter(hasRating => !hasRating).length;

      if (unratedPersonnelCount > 0) {
        const message = `${unratedPersonnelCount} personel hiç puanlanmamış. Devam etmek istiyor musunuz?`;
        const shouldContinue = Platform.OS === 'web'
          ? window.confirm(message)
          : await new Promise<boolean>((resolve) => {
              const Alert = require('react-native').Alert;
              Alert.alert('Uyarı', message, [
                { text: 'İptal', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Devam Et', onPress: () => resolve(true) },
              ]);
            });

        if (!shouldContinue) {
          return;
        }
      }

      const updateData: any = {
        status: 'approved_manager',
        manager_approved_by: profile?.id,
        manager_approved_at: new Date().toISOString(),
      };

      if (note && note.trim()) {
        updateData.manager_approval_note = note.trim();
      }

      const { data, error } = await supabase
        .from('timesheet_periods')
        .update(updateData)
        .eq('id', timesheetId)
        .select();

      if (error) {
        console.error('Onaylama hatası:', error);
        throw error;
      }

      console.log('Puantaj güncellendi:', data, 'bildirimler gönderiliyor...');

      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true);

      const { data: operations } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'operations')
        .eq('is_active', true);

      const notificationUsers = [
        ...(admins?.map(a => a.id) || []),
        ...(operations?.map(o => o.id) || [])
      ];

      if (notificationUsers.length > 0) {
        const notifications = notificationUsers.map(userId => ({
          user_id: userId,
          title: 'Puantaj Onaylandı',
          message: 'Bir proje yöneticisi puantaj onayladı. İncelemeniz gerekiyor.',
          type: 'system',
        }));

        await supabase.from('notifications').insert(notifications);
        console.log('Bildirimler gönderildi:', notifications.length);
      }

      if (Platform.OS === 'web') {
        window.alert('Başarılı! Puantaj onaylandı ve yetkililere bildirim gönderildi');
      } else {
        const Alert = require('react-native').Alert;
        Alert.alert('Başarılı', 'Puantaj onaylandı ve yetkililere bildirim gönderildi');
      }
      setApproveModalVisible(false);
      setSelectedTimesheet(null);
      setApprovalNote('');
      loadTimesheets();
    } catch (error: any) {
      console.error('Hata detayı:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Onaylama başarısız'));
      } else {
        const Alert = require('react-native').Alert;
        Alert.alert('Hata', error.message || 'Onaylama başarısız');
      }
    }
  };

  const handleApproveSubmit = async () => {
    if (!selectedTimesheet) return;
    await performApproval(selectedTimesheet.id, approvalNote);
  };

  const handleRejectClick = (timesheet: TimesheetPeriod) => {
    setSelectedTimesheet(timesheet);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Uyarı: Lütfen red nedenini yazın');
      } else {
        const Alert = require('react-native').Alert;
        Alert.alert('Uyarı', 'Lütfen red nedenini yazın');
      }
      return;
    }

    if (!selectedTimesheet) return;

    try {
      const { error } = await supabase
        .from('timesheet_periods')
        .update({
          status: 'rejected_manager',
          rejection_reason: rejectionReason,
          manager_rejected_at: new Date().toISOString(),
        })
        .eq('id', selectedTimesheet.id);

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Başarılı! Puantaj reddedildi');
      } else {
        const Alert = require('react-native').Alert;
        Alert.alert('Başarılı', 'Puantaj reddedildi');
      }
      setRejectModalVisible(false);
      setSelectedTimesheet(null);
      setRejectionReason('');
      loadTimesheets();
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Reddetme başarısız'));
      } else {
        const Alert = require('react-native').Alert;
        Alert.alert('Hata', error.message || 'Reddetme başarısız');
      }
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

  const pendingTimesheets = timesheets.filter(t => t.status === 'pending_manager');
  const otherTimesheets = timesheets.filter(t => t.status !== 'pending_manager');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Puantaj Onayları</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.emptyText}>Yükleniyor...</Text>
        ) : timesheets.length === 0 ? (
          <Text style={styles.emptyText}>Size atanmış proje bulunamadı</Text>
        ) : (
          <>
            {pendingTimesheets.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>ONAY BEKLEYENLER ({pendingTimesheets.length})</Text>
                {pendingTimesheets.map((timesheet) => {
                  const statusConfig = getStatusConfig(timesheet.status);
                  const StatusIcon = statusConfig.Icon;

                  const workDays = calculateWorkDays(timesheet.period_start, timesheet.period_end);
                  const overtimeInfo = calculateOvertimeInfo(timesheet.total_hours || 0, workDays);

                  return (
                    <View key={timesheet.id} style={[styles.timesheetCard, styles.pendingCard]}>
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
                        <Text style={styles.workDaysText}>{workDays} iş günü</Text>
                      </View>

                      <View style={styles.timesheetStats}>
                        <View style={styles.stat}>
                          <Text style={styles.statLabel}>Gün</Text>
                          <Text style={styles.statValue}>{workDays}</Text>
                        </View>
                        <View style={styles.stat}>
                          <Text style={styles.statLabel}>Toplam Saat</Text>
                          <Text style={styles.statValue}>{timesheet.total_hours || 0}h</Text>
                        </View>
                        <View style={styles.stat}>
                          <Text style={styles.statLabel}>Personel</Text>
                          <Text style={styles.statValue}>{timesheet.total_personnel || 0}</Text>
                        </View>
                      </View>

                      {(overtimeInfo.overtime > 0 || overtimeInfo.undertime > 0) && (
                        <View style={styles.overtimeBox}>
                          {overtimeInfo.overtime > 0 && (
                            <Text style={styles.overtimeText}>
                              ✓ Fazla Mesai: <Text style={styles.overtimeBold}>{overtimeInfo.overtime.toFixed(1)}h</Text>
                            </Text>
                          )}
                          {overtimeInfo.undertime > 0 && (
                            <Text style={styles.undertimeText}>
                              ⚠ Eksik Mesai: <Text style={styles.undertimeBold}>{overtimeInfo.undertime.toFixed(1)}h</Text>
                            </Text>
                          )}
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.detailButton}
                        onPress={() => router.push(`/manager/timesheet-detail?id=${timesheet.id}`)}
                      >
                        <Eye size={16} color={COLORS.primary} />
                        <Text style={styles.detailButtonText}>Detayları Gör</Text>
                      </TouchableOpacity>

                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleRejectClick(timesheet)}
                        >
                          <XCircle size={18} color={COLORS.danger} />
                          <Text style={styles.rejectButtonText}>Reddet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approveButton}
                          onPress={() => handleApprove(timesheet)}
                        >
                          <CheckCircle size={18} color="white" />
                          <Text style={styles.approveButtonText}>Onayla</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {otherTimesheets.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>GEÇMİŞ PUANTAJLAR</Text>
                {otherTimesheets.map((timesheet) => {
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

                      {timesheet.rejection_reason && (
                        <View style={styles.rejectionBox}>
                          <Text style={styles.rejectionLabel}>Red Nedeni:</Text>
                          <Text style={styles.rejectionText}>{timesheet.rejection_reason}</Text>
                        </View>
                      )}

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

                      <TouchableOpacity
                        style={styles.detailButtonSecondary}
                        onPress={() => router.push(`/manager/timesheet-detail?id=${timesheet.id}`)}
                      >
                        <Eye size={16} color={COLORS.primary} />
                        <Text style={styles.detailButtonText}>Detayları Gör</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={approveModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Puantaj Onayla</Text>
            <Text style={styles.modalSubtitle}>İsteğe bağlı: Onay yorumu ekleyebilirsiniz</Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Onay yorumu (isteğe bağlı)..."
              value={approvalNote}
              onChangeText={setApprovalNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setApproveModalVisible(false);
                  setSelectedTimesheet(null);
                  setApprovalNote('');
                }}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApproveButton} onPress={handleApproveSubmit}>
                <Text style={styles.modalApproveText}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rejectModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Puantaj Reddet</Text>
            <Text style={styles.modalSubtitle}>Lütfen red nedenini açıklayın:</Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Red nedeni..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setRejectModalVisible(false);
                  setSelectedTimesheet(null);
                  setRejectionReason('');
                }}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRejectButton} onPress={handleRejectSubmit}>
                <Text style={styles.modalRejectText}>Reddet</Text>
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
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 12,
    marginTop: 8,
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
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
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
  workDaysText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
    gap: 6,
  },
  rejectButtonText: {
    color: COLORS.danger,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    gap: 6,
  },
  approveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  rejectionBox: {
    backgroundColor: COLORS.danger + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  detailButtonSecondary: {
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
    marginTop: 12,
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
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
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 100,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalRejectButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
  },
  modalRejectText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalApproveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    alignItems: 'center',
  },
  modalApproveText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  overtimeBox: {
    backgroundColor: COLORS.bg,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  overtimeText: {
    fontSize: 13,
    color: COLORS.success,
  },
  overtimeBold: {
    fontWeight: '700',
  },
  undertimeText: {
    fontSize: 13,
    color: COLORS.warning,
  },
  undertimeBold: {
    fontWeight: '700',
  },
});
