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
import { ArrowLeft, CheckCircle, DollarSign, FileText, Calendar, User, Clock } from 'lucide-react-native';
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
  project: { name: string };
  personnel_breakdown: any[];
};

export default function AdminInvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

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
        .eq('status', 'submitted')
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

  const showDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hakediş Kayıtları</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : invoices.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Henüz hakediş kaydı yok</Text>
          </View>
        ) : (
          invoices.map((invoice) => (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceCard}
              onPress={() => showDetail(invoice)}
            >
              <View style={styles.invoiceHeader}>
                <View>
                  <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                  <View style={styles.statusBadge}>
                    <CheckCircle size={14} color={COLORS.success} />
                    <Text style={styles.statusText}>Faturalandırmaya Hazır</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.projectName}>{invoice.project?.name || 'Proje'}</Text>

              <View style={styles.invoiceDateRow}>
                <Calendar size={14} color={COLORS.textLight} />
                <Text style={styles.invoiceDate}>
                  {new Date(invoice.period_start).toLocaleDateString('tr-TR')} -{' '}
                  {new Date(invoice.period_end).toLocaleDateString('tr-TR')}
                </Text>
              </View>

              <View style={styles.invoiceStats}>
                <View style={styles.statItem}>
                  <Clock size={16} color={COLORS.textLight} />
                  <Text style={styles.statText}>{invoice.total_hours}h</Text>
                </View>
                <View style={styles.statItem}>
                  <User size={16} color={COLORS.textLight} />
                  <Text style={styles.statText}>{invoice.total_personnel} kişi</Text>
                </View>
                <View style={styles.statItem}>
                  <DollarSign size={16} color={COLORS.success} />
                  {invoice.personnel_breakdown?.some((p: any) => p.adjusted_amount) ? (
                    <View style={styles.amountColumn}>
                      <Text style={[styles.statText, styles.strikethroughCardAmount]}>
                        {invoice.personnel_breakdown?.reduce((sum: number, p: any) =>
                          sum + (p.original_amount || p.total_amount), 0
                        ).toLocaleString('tr-TR')} ₺
                      </Text>
                      <Text style={[styles.statText, { color: COLORS.success, fontWeight: '700' }]}>
                        {invoice.total_amount.toLocaleString('tr-TR')} ₺
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.statText, { color: COLORS.success, fontWeight: '700' }]}>
                      {invoice.total_amount.toLocaleString('tr-TR')} ₺
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hakediş Detayı</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <ArrowLeft size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {selectedInvoice && (
                <>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Genel Bilgiler</Text>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Hakediş No:</Text>
                      <Text style={styles.modalValue}>{selectedInvoice.invoice_number}</Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Proje:</Text>
                      <Text style={styles.modalValue}>{selectedInvoice.project?.name}</Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Dönem:</Text>
                      <Text style={styles.modalValue}>
                        {new Date(selectedInvoice.period_start).toLocaleDateString('tr-TR')} -{' '}
                        {new Date(selectedInvoice.period_end).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Gönderilme:</Text>
                      <Text style={styles.modalValue}>
                        {new Date(selectedInvoice.approved_at || selectedInvoice.created_at).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
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

                  <View style={styles.submittedInfo}>
                    <CheckCircle size={20} color={COLORS.success} />
                    <Text style={styles.submittedInfoText}>Bu hakediş faturalandırmaya hazır olarak işaretlenmiştir</Text>
                  </View>
                </>
              )}
            </ScrollView>
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
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  invoiceDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  invoiceDate: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  invoiceStats: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  strikethroughCardAmount: {
    textDecorationLine: 'line-through',
    fontSize: 11,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
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
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalScroll: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  personnelList: {
    gap: 12,
  },
  personnelItem: {
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
  },
  personnelItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
    backgroundColor: '#FFF9E6',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA500',
  },
  adjustmentNoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CC8400',
    marginBottom: 2,
  },
  adjustmentNoteText: {
    fontSize: 11,
    color: COLORS.text,
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
