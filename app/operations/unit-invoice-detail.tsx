import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, Calendar, DollarSign, MessageSquare, CheckCircle, XCircle, Edit3 } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

interface UnitInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  adjusted_amount?: number | null;
  adjustment_notes?: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  project: { name: string };
  work_order: {
    order_number: string;
    quantity: number;
    unit_price: number;
    service_type: { name: string; unit_type: string };
  };
}

export default function UnitInvoiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<UnitInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedAmount, setEditedAmount] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  useEffect(() => {
    fetchInvoiceDetail();
  }, [id]);

  const fetchInvoiceDetail = async () => {
    try {
      setLoading(true);
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
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        Alert.alert('Hata', 'Hakediş bulunamadı');
        router.back();
        return;
      }

      setInvoice(data);
      setEditedAmount((data.adjusted_amount ?? data.total_amount).toString());
      setEditedNotes(data.adjustment_notes || '');
      console.log('Invoice yüklendi:', { id: data.id, status: data.status });
    } catch (error: any) {
      console.error('Hakediş detay yükleme hatası:', error);
      Alert.alert('Hata', error.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!invoice) return;
    setEditedAmount((invoice.adjusted_amount ?? invoice.total_amount).toString());
    setEditedNotes(invoice.adjustment_notes || '');
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !invoice) return;

    const amount = parseFloat(editedAmount);
    if (isNaN(amount) || amount <= 0) {
      if (Platform.OS === 'web') {
        window.alert('Geçerli bir tutar giriniz');
      } else {
        Alert.alert('Hata', 'Geçerli bir tutar giriniz');
      }
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('unit_invoices')
        .update({
          adjusted_amount: amount,
          adjustment_notes: editedNotes || null,
        })
        .eq('id', id);

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Hakediş güncellendi');
      } else {
        Alert.alert('Başarılı', 'Hakediş güncellendi');
      }
      setEditMode(false);
      fetchInvoiceDetail();
    } catch (error: any) {
      console.error('Güncelleme hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + error.message);
      } else {
        Alert.alert('Hata', error.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    console.log('handleApprove çağrıldı, user:', user);
    if (!user) {
      console.error('User bulunamadı!');
      if (Platform.OS === 'web') {
        window.alert('Kullanıcı bilgisi bulunamadı. Lütfen yeniden giriş yapın.');
      } else {
        Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı. Lütfen yeniden giriş yapın.');
      }
      return;
    }

    const confirmApproval = async () => {
      try {
        setActionLoading(true);
        const updateData: any = {
          status: 'operations_approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        };

        if (actionNotes.trim()) {
          updateData.notes = actionNotes;
        }

        const { error } = await supabase
          .from('unit_invoices')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;

        // Refresh the invoice data
        await fetchInvoiceDetail();

        if (Platform.OS === 'web') {
          window.alert('Hakediş onaylandı ve faturalanmaya hazır');
        } else {
          Alert.alert('Başarılı', 'Hakediş onaylandı ve faturalanmaya hazır');
        }
      } catch (error: any) {
        console.error('Onaylama hatası:', error);
        if (Platform.OS === 'web') {
          window.alert('Hata: ' + error.message);
        } else {
          Alert.alert('Hata', error.message);
        }
      } finally {
        setActionLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Bu hakedişi onaylamak istediğinizden emin misiniz?\n\nOnaylanan hakediş admin tarafından faturalanmaya hazır olarak görülecektir.'
      );
      if (confirmed) {
        await confirmApproval();
      }
    } else {
      Alert.alert(
        'Hakediş Onayı',
        'Bu hakedişi onaylamak istediğinizden emin misiniz? Onaylanan hakediş admin tarafından faturalanmaya hazır olarak görülecektir.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Onayla',
            onPress: confirmApproval,
          },
        ]
      );
    }
  };

  const handleReject = async () => {
    if (!user) {
      if (Platform.OS === 'web') {
        window.alert('Kullanıcı bilgisi bulunamadı. Lütfen yeniden giriş yapın.');
      } else {
        Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı. Lütfen yeniden giriş yapın.');
      }
      return;
    }

    const confirmRejection = async () => {
      try {
        setActionLoading(true);
        const updateData: any = {
          status: 'cancelled',
        };

        if (actionNotes.trim()) {
          updateData.notes = actionNotes;
        }

        const { error } = await supabase
          .from('unit_invoices')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;

        // Refresh the invoice data
        await fetchInvoiceDetail();

        if (Platform.OS === 'web') {
          window.alert('Hakediş reddedildi');
        } else {
          Alert.alert('Başarılı', 'Hakediş reddedildi');
        }
      } catch (error: any) {
        console.error('Reddetme hatası:', error);
        if (Platform.OS === 'web') {
          window.alert('Hata: ' + error.message);
        } else {
          Alert.alert('Hata', error.message);
        }
      } finally {
        setActionLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Bu hakedişi reddetmek istediğinizden emin misiniz?\n\nReddedilen hakediş iptal olarak işaretlenecek.'
      );
      if (confirmed) {
        await confirmRejection();
      }
    } else {
      Alert.alert(
        'Hakediş Reddi',
        'Bu hakedişi reddetmek istediğinizden emin misiniz? Reddedilen hakediş iptal olarak işaretlenecek.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Reddet',
            style: 'destructive',
            onPress: confirmRejection,
          },
        ]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_operations_approval':
        return COLORS.warning;
      case 'operations_approved':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textLight;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_operations_approval':
        return 'Onay Bekliyor';
      case 'operations_approved':
        return 'Faturalanmaya Hazır';
      case 'cancelled':
        return 'İptal';
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
          <Text style={styles.headerTitle}>Hakediş Detayı</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) return null;

  const canEdit = invoice.status === 'pending_operations_approval';
  console.log('canEdit kontrol:', { status: invoice.status, canEdit, user: !!user });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hakediş Detayı</Text>
        {canEdit && (
          <TouchableOpacity onPress={handleEdit}>
            <Edit3 size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        {!canEdit && <View style={{ width: 24 }} />}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
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
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>İş Emri Bilgileri</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>İş Emri No:</Text>
            <Text style={styles.value}>#{invoice.work_order.order_number}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Hizmet Türü:</Text>
            <Text style={styles.value}>{invoice.work_order.service_type.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Miktar:</Text>
            <Text style={styles.value}>
              {invoice.work_order.quantity} {invoice.work_order.service_type.unit_type}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Birim Fiyat:</Text>
            <Text style={styles.value}>₺{invoice.work_order.unit_price.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <DollarSign size={20} color={COLORS.success} />
            <Text style={styles.sectionTitle}>Fiyat Bilgileri</Text>
          </View>

          <View style={styles.calculationBox}>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Miktar:</Text>
              <Text style={styles.calculationValue}>
                {invoice.work_order.quantity} {invoice.work_order.service_type.unit_type}
              </Text>
            </View>

            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Birim Fiyat:</Text>
              <Text style={styles.calculationValue}>
                ₺{invoice.work_order.unit_price.toFixed(2)}
              </Text>
            </View>

            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Orijinal Tutar:</Text>
              <Text style={styles.calculationValue}>
                ₺{invoice.total_amount.toFixed(2)}
              </Text>
            </View>

            {invoice.adjusted_amount != null && (
              <View style={[styles.calculationRow, styles.adjustedRow]}>
                <Text style={styles.adjustedLabel}>Düzeltilmiş Tutar:</Text>
                <Text style={styles.adjustedValue}>
                  ₺{invoice.adjusted_amount.toFixed(2)}
                </Text>
              </View>
            )}

            <View style={[styles.calculationRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Hakediş Tutarı:</Text>
              <Text style={styles.totalValue}>
                ₺{(invoice.adjusted_amount ?? invoice.total_amount).toFixed(2)}
              </Text>
            </View>

            {invoice.adjustment_notes && (
              <View style={styles.adjustmentNotesBox}>
                <Text style={styles.adjustmentNotesLabel}>Düzeltme Açıklaması:</Text>
                <Text style={styles.adjustmentNotesText}>{invoice.adjustment_notes}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Tarih Bilgileri</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Hakediş Tarihi:</Text>
            <Text style={styles.value}>
              {new Date(invoice.invoice_date).toLocaleDateString('tr-TR')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Oluşturulma:</Text>
            <Text style={styles.value}>
              {new Date(invoice.created_at).toLocaleString('tr-TR')}
            </Text>
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MessageSquare size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Notlar</Text>
            </View>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          </View>
        )}

        {canEdit && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MessageSquare size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>İşlem Notu (Opsiyonel)</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Hakediş ile ilgili notlarınızı buraya yazabilirsiniz..."
              placeholderTextColor={COLORS.textLight}
              value={actionNotes}
              onChangeText={setActionNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}
      </ScrollView>

      {canEdit && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <XCircle size={20} color="white" />
                <Text style={styles.actionButtonText}>Reddet</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <CheckCircle size={20} color="white" />
                <Text style={styles.actionButtonText}>Onayla</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={editMode}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditMode(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hakediş Düzenle</Text>
              <TouchableOpacity onPress={() => setEditMode(false)}>
                <XCircle size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.amountComparisonBox}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Orijinal Tutar</Text>
                  <Text style={styles.originalAmount}>
                    ₺{(invoice.work_order.quantity * invoice.work_order.unit_price).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>İş Emri</Text>
                  <Text style={styles.workOrderInfo}>
                    {invoice.work_order.quantity} {invoice.work_order.service_type.unit_type} × ₺{invoice.work_order.unit_price.toFixed(2)}
                  </Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Düzeltilmiş Tutar (₺)</Text>
              <TextInput
                style={styles.input}
                value={editedAmount}
                onChangeText={setEditedAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textLight}
              />
              <Text style={styles.inputHint}>
                Miktar veya birim fiyat değişikliği varsa düzeltilmiş tutarı giriniz
              </Text>

              <Text style={styles.inputLabel}>Notlar</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="Hakediş ile ilgili notlar..."
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditMode(false)}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveEdit}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Kaydet</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: 14,
    color: COLORS.textLight,
    width: 120,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: COLORS.secondary,
    flex: 1,
    fontWeight: '600',
  },
  calculationBox: {
    padding: 15,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calculationLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  calculationValue: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    color: COLORS.success,
    fontWeight: '700',
  },
  adjustedRow: {
    backgroundColor: COLORS.warning + '15',
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  adjustedLabel: {
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '600',
  },
  adjustedValue: {
    fontSize: 16,
    color: COLORS.warning,
    fontWeight: '700',
  },
  adjustmentNotesBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  adjustmentNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  adjustmentNotesText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  notesBox: {
    padding: 15,
    backgroundColor: COLORS.bg,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  notesInput: {
    padding: 15,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalBody: {
    padding: 20,
  },
  amountComparisonBox: {
    backgroundColor: COLORS.primary + '10',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  originalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  workOrderInfo: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
    marginTop: 12,
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 6,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
