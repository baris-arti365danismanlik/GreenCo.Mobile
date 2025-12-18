import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileText, DollarSign, MessageSquare, X, Send, CheckCircle, XCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  project: { name: string };
  work_order: {
    order_number: string;
    service_type: { name: string; unit_type: string };
    quantity: number;
    unit_price: number;
  };
};

export default function ManagerUnitInvoicesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [invoiceToAction, setInvoiceToAction] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const { data: managedProjects } = await supabase
        .from('project_managers')
        .select('project_id')
        .eq('manager_id', profile!.id);

      const projectIds = managedProjects?.map(pm => pm.project_id) || [];

      if (projectIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('unit_invoices')
        .select(`
          *,
          project:projects_greenco(name),
          work_order:unit_based_work_orders(
            order_number,
            quantity,
            unit_price,
            service_type:service_types(name, unit_type)
          )
        `)
        .in('project_id', projectIds)
        .in('status', ['pending_manager_review', 'pending_operations_approval', 'operations_approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      console.error('Hakedişler yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeedback = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setFeedback('');
    setModalVisible(true);
  };

  const handleSubmitFeedback = async () => {
    if (!selectedInvoice || !feedback.trim()) {
      Alert.alert('Uyarı', 'Lütfen bir yorum yazın');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('unit_invoices')
        .update({
          notes: feedback.trim(),
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'Yorumunuz kaydedildi');
      setModalVisible(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Yorum ekleme hatası:', error);
      Alert.alert('Hata', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = (invoice: Invoice) => {
    setInvoiceToAction(invoice);
    setConfirmAction('approve');
    setConfirmModalVisible(true);
  };

  const handleReject = (invoice: Invoice) => {
    setInvoiceToAction(invoice);
    setConfirmAction('reject');
    setConfirmModalVisible(true);
  };

  const executeAction = async () => {
    if (!invoiceToAction || !confirmAction) return;

    setActionLoading(true);
    setConfirmModalVisible(false);

    try {
      const status = confirmAction === 'approve' ? 'pending_operations_approval' : 'cancelled';
      console.log(`Hakediş ${confirmAction} işlemi başladı:`, invoiceToAction.id);

      const { data, error } = await supabase
        .from('unit_invoices')
        .update({ status })
        .eq('id', invoiceToAction.id)
        .select();

      console.log('Update sonucu:', { data, error });

      if (error) {
        console.error('Update hatası detay:', error);
        throw error;
      }

      console.log(`Hakediş başarıyla ${confirmAction === 'approve' ? 'onaylandı' : 'reddedildi'}`);
      Alert.alert(
        'Başarılı',
        confirmAction === 'approve'
          ? 'Hakediş onaylandı ve operasyon onayına gönderildi'
          : 'Hakediş reddedildi'
      );
      await loadInvoices();
    } catch (error: any) {
      console.error(`${confirmAction} hatası:`, error);
      Alert.alert('Hata', `İşlem tamamlanamadı: ${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setActionLoading(false);
      setInvoiceToAction(null);
      setConfirmAction(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_manager_review':
        return COLORS.warning;
      case 'pending_operations_approval':
        return COLORS.info;
      case 'operations_approved':
        return COLORS.success;
      case 'submitted':
        return COLORS.info;
      case 'paid':
        return COLORS.primary;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textLight;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_manager_review':
        return 'Onayınızı Bekliyor';
      case 'pending_operations_approval':
        return 'Operasyon Onayı Bekliyor';
      case 'operations_approved':
        return 'Operasyon Onaylandı';
      case 'submitted':
        return 'Gönderildi';
      case 'paid':
        return 'Ödendi';
      case 'cancelled':
        return 'İptal Edildi';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Birim Bazlı Hakedişler</Text>
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
        <Text style={styles.headerTitle}>Birim Bazlı Hakedişler</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {invoices.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Henüz hakediş bulunmuyor</Text>
          </View>
        ) : (
          invoices.map((invoice) => (
            <View key={invoice.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                  <Text style={styles.projectName}>{invoice.project.name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                    {getStatusText(invoice.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <FileText size={16} color={COLORS.textLight} />
                  <Text style={styles.infoLabel}>İş Emri:</Text>
                  <Text style={styles.infoValue}>#{invoice.work_order.order_number}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Hizmet:</Text>
                  <Text style={styles.infoValue}>{invoice.work_order.service_type.name}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Miktar:</Text>
                  <Text style={styles.infoValue}>
                    {invoice.work_order.quantity} {invoice.work_order.service_type.unit_type}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Birim Fiyat:</Text>
                  <Text style={styles.infoValue}>₺{invoice.work_order.unit_price?.toFixed(2)}</Text>
                </View>

                <View style={[styles.infoRow, styles.totalRow]}>
                  <DollarSign size={18} color={COLORS.success} />
                  <Text style={styles.totalLabel}>Toplam:</Text>
                  <Text style={styles.totalValue}>₺{invoice.total_amount.toFixed(2)}</Text>
                </View>

                <View style={styles.dateRow}>
                  <Calendar size={14} color={COLORS.textLight} />
                  <Text style={styles.dateText}>
                    Hakediş Tarihi: {new Date(invoice.invoice_date).toLocaleDateString('tr-TR')}
                  </Text>
                </View>

                {invoice.notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Notlar:</Text>
                    <Text style={styles.notesText}>{invoice.notes}</Text>
                  </View>
                )}

                {invoice.status === 'pending_manager_review' && (
                  <>
                    <TouchableOpacity
                      style={styles.feedbackButton}
                      onPress={() => handleAddFeedback(invoice)}
                    >
                      <MessageSquare size={18} color={COLORS.primary} />
                      <Text style={styles.feedbackButtonText}>
                        {invoice.notes ? 'Yorumu Düzenle' : 'Yorum Ekle'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleReject(invoice)}
                        disabled={actionLoading}
                      >
                        <XCircle size={18} color={COLORS.error} />
                        <Text style={[styles.actionButtonText, { color: COLORS.error }]}>
                          Reddet
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApprove(invoice)}
                        disabled={actionLoading}
                      >
                        <CheckCircle size={18} color="white" />
                        <Text style={[styles.actionButtonText, { color: 'white' }]}>
                          Onayla ve Operasyona Gönder
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hakediş Yorumu</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Yorumunuz</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Hakediş ile ilgili yorumlarınızı yazın..."
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={6}
              />

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.5 }]}
                onPress={handleSubmitFeedback}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Send size={20} color="white" />
                )}
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Gönderiliyor...' : 'Gönder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmTitle}>
              {confirmAction === 'approve' ? 'Hakediş Onayı' : 'Hakediş Reddi'}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmAction === 'approve'
                ? 'Bu hakediş kaydını onaylamak istediğinizden emin misiniz?'
                : 'Bu hakediş kaydını reddetmek istediğinizden emin misiniz?'}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  setInvoiceToAction(null);
                  setConfirmAction(null);
                }}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  confirmAction === 'approve' ? styles.approveConfirmButton : styles.rejectConfirmButton,
                  actionLoading && { opacity: 0.5 }
                ]}
                onPress={executeAction}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {confirmAction === 'approve' ? 'Onayla' : 'Reddet'}
                  </Text>
                )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
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
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  invoiceNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  projectName: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  notesSection: {
    marginTop: 10,
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
  },
  feedbackButtonText: {
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
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.secondary,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 15,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContent: {
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
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  approveConfirmButton: {
    backgroundColor: COLORS.success,
  },
  rejectConfirmButton: {
    backgroundColor: COLORS.error,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
