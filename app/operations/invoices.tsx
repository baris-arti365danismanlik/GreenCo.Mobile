import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, CheckCircle, DollarSign, FileText, XCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Invoice = {
  id: string;
  invoice_number: string;
  project_id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  total_personnel: number;
  total_amount: number;
  status: string;
  created_at: string;
  approved_at?: string;
  paid_at?: string;
  project: { name: string };
  personnel_breakdown: any[];
};

export default function OperationsInvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
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

      setInvoices(formattedData);
    } catch (error) {
      console.error('Hakediş yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredInvoices = () => {
    if (filter === 'pending') return invoices.filter(i => i.status === 'pending');
    if (filter === 'submitted') return invoices.filter(i => i.status === 'submitted');
    return invoices;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Taslak', color: COLORS.warning, Icon: Clock };
      case 'submitted':
        return { label: 'Faturalandırmaya Hazır', color: COLORS.success, Icon: CheckCircle };
      default:
        return { label: 'Bilinmiyor', color: COLORS.textLight, Icon: Clock };
    }
  };

  const showDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailModalVisible(true);
  };

  const handleSubmitToAdmin = async () => {
    if (!selectedInvoice) return;

    const confirmed = confirm(
      `Bu hakediş'i faturalandırmaya hazır olarak işaretlemek istediğinize emin misiniz?\n\nHakediş No: ${selectedInvoice.invoice_number}\nTutar: ${selectedInvoice.total_amount.toLocaleString('tr-TR')} ₺\n\nNot: İşaretledikten sonra değişiklik yapamazsınız.`
    );

    if (!confirmed) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'submitted',
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      alert('Başarılı! Hakediş faturalandırmaya hazır olarak işaretlendi.');
      setDetailModalVisible(false);
      loadInvoices();
    } catch (error: any) {
      console.error('Gönderme hatası:', error);
      alert('Hata: ' + (error.message || 'Hakediş gönderilemedi'));
    } finally {
      setUpdating(false);
    }
  };

  const filteredInvoices = getFilteredInvoices();
  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const submittedCount = invoices.filter(i => i.status === 'submitted').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hakediş Kayıtları</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Tümü ({invoices.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Taslak ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'submitted' && styles.filterButtonActive]}
          onPress={() => setFilter('submitted')}
        >
          <Text style={[styles.filterText, filter === 'submitted' && styles.filterTextActive]}>
            Hazır ({submittedCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Hakediş bulunamadı</Text>
          </View>
        ) : (
          filteredInvoices.map((invoice) => {
            const statusConfig = getStatusConfig(invoice.status);
            const StatusIcon = statusConfig.Icon;

            return (
              <TouchableOpacity
                key={invoice.id}
                style={styles.invoiceCard}
                onPress={() => showDetail(invoice)}
              >
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceNumberBox}>
                    <FileText size={16} color={COLORS.primary} />
                    <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    <StatusIcon size={14} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.projectName}>{invoice.project?.name || 'Proje'}</Text>

                <View style={styles.invoiceInfo}>
                  <Text style={styles.dateRange}>
                    {new Date(invoice.period_start).toLocaleDateString('tr-TR')} -{' '}
                    {new Date(invoice.period_end).toLocaleDateString('tr-TR')}
                  </Text>
                </View>

                <View style={styles.invoiceStats}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Toplam Saat</Text>
                    <Text style={styles.statValue}>{invoice.total_hours}h</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Personel</Text>
                    <Text style={styles.statValue}>{invoice.total_personnel}</Text>
                  </View>
                  <View style={styles.stat}>
                    <DollarSign size={14} color={COLORS.success} style={{ marginBottom: 4 }} />
                    {invoice.personnel_breakdown?.some((p: any) => p.adjusted_amount) ? (
                      <View style={styles.amountColumn}>
                        <Text style={[styles.statValue, styles.strikethroughCardAmount]}>
                          {invoice.personnel_breakdown?.reduce((sum: number, p: any) =>
                            sum + (p.original_amount || p.total_amount), 0
                          ).toLocaleString('tr-TR')} ₺
                        </Text>
                        <Text style={[styles.statValue, { color: COLORS.success }]}>
                          {invoice.total_amount.toLocaleString('tr-TR')} ₺
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.statValue, { color: COLORS.success }]}>
                        {invoice.total_amount.toLocaleString('tr-TR')} ₺
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={detailModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
            {selectedInvoice && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedInvoice.invoice_number}</Text>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <XCircle size={24} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalProjectName}>{selectedInvoice.project?.name}</Text>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Dönem</Text>
                  <Text style={styles.modalText}>
                    {new Date(selectedInvoice.period_start).toLocaleDateString('tr-TR')} -{' '}
                    {new Date(selectedInvoice.period_end).toLocaleDateString('tr-TR')}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Personel Detayı ({selectedInvoice.personnel_breakdown?.length || 0})</Text>
                  <View style={styles.personnelList}>
                    {selectedInvoice.personnel_breakdown?.map((person: any, index: number) => (
                      <View key={index} style={styles.personnelItem}>
                        <View style={styles.personnelItemHeader}>
                          <Text style={styles.personnelName}>{person.full_name}</Text>
                          <View style={styles.personnelAmountContainer}>
                            {person.adjusted_amount ? (
                              <>
                                <Text style={[styles.personnelAmount, styles.strikethroughAmount]}>
                                  {person.original_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </Text>
                                <Text style={styles.personnelAmount}>
                                  {person.adjusted_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </Text>
                              </>
                            ) : (
                              <Text style={styles.personnelAmount}>
                                {person.total_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.personnelCalculation}>
                          <Text style={styles.personnelCalculationText}>
                            Günlük: {person.total_days} gün × {person.daily_rate?.toLocaleString('tr-TR')} ₺ = {person.daily_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </Text>
                          {person.overtime_hours > 0 && (
                            <Text style={styles.personnelCalculationText}>
                              Fazla Mesai: {person.overtime_hours?.toFixed(1)}h × {person.overtime_rate?.toLocaleString('tr-TR')} ₺ = {person.overtime_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </Text>
                          )}
                          {person.adjustment_reason && (
                            <View style={styles.adjustmentNote}>
                              <Text style={styles.adjustmentNoteLabel}>Düzeltme Nedeni:</Text>
                              <Text style={styles.adjustmentNoteText}>{person.adjustment_reason}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.modalTotalBox}>
                  <Text style={styles.modalTotalLabel}>TOPLAM TUTAR</Text>
                  {selectedInvoice.personnel_breakdown?.some((p: any) => p.adjusted_amount) ? (
                    <>
                      <View style={styles.totalRow}>
                        <Text style={[styles.modalTotalSubLabel, styles.strikethroughText]}>Orijinal:</Text>
                        <Text style={[styles.modalTotalSubValue, styles.strikethroughText]}>
                          {selectedInvoice.personnel_breakdown?.reduce((sum: number, p: any) =>
                            sum + (p.original_amount || p.total_amount), 0
                          ).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.modalTotalSubLabel}>Düzeltilmiş:</Text>
                        <Text style={styles.modalTotalValue}>
                          {selectedInvoice.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.modalTotalValue}>
                      {selectedInvoice.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </Text>
                  )}
                </View>

                {selectedInvoice.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmitToAdmin}
                    disabled={updating}
                  >
                    <CheckCircle size={20} color="white" />
                    <Text style={styles.submitButtonText}>
                      {updating ? 'İşleniyor...' : 'Faturalandırmaya Hazır'}
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedInvoice.status === 'submitted' && (
                  <View style={styles.submittedInfo}>
                    <CheckCircle size={20} color={COLORS.success} />
                    <Text style={styles.submittedInfoText}>Bu hakediş faturalandırmaya hazır olarak işaretlenmiştir</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
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
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 11,
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
  invoiceCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceNumberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  invoiceNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
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
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  invoiceInfo: {
    marginBottom: 12,
  },
  dateRange: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  invoiceStats: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  amountColumn: {
    alignItems: 'center',
    gap: 2,
  },
  strikethroughCardAmount: {
    textDecorationLine: 'line-through',
    fontSize: 12,
    opacity: 0.5,
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
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalProjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.text,
  },
  personnelList: {
  },
  personnelItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  personnelItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  personnelName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },
  personnelAmountContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  personnelAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  strikethroughAmount: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
    fontSize: 12,
    color: COLORS.textLight,
  },
  personnelDetail: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  personnelCalculation: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  personnelCalculationText: {
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 2,
  },
  adjustmentNote: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  adjustmentNoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  adjustmentNoteText: {
    fontSize: 11,
    color: COLORS.secondary,
    lineHeight: 16,
  },
  modalTotalBox: {
    backgroundColor: COLORS.success,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
    opacity: 0.9,
    marginBottom: 4,
  },
  modalTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  modalTotalSubLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    opacity: 0.9,
  },
  modalTotalSubValue: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    opacity: 0.9,
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  submittedInfo: {
    backgroundColor: COLORS.success + '15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  submittedInfoText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.success,
  },
});
