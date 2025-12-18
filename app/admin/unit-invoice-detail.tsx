import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, Calendar, DollarSign, MessageSquare } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

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
  creator: { full_name: string };
}

export default function UnitInvoiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const [invoice, setInvoice] = useState<UnitInvoice | null>(null);
  const [loading, setLoading] = useState(true);

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
          ),
          creator:profiles!unit_invoices_created_by_fkey(full_name)
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
    } catch (error: any) {
      console.error('Hakediş detay yükleme hatası:', error);
      Alert.alert('Hata', error.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_manager_review: COLORS.warning,
      pending_operations_approval: COLORS.info,
      operations_approved: COLORS.success,
      cancelled: COLORS.error,
    };
    return colors[status] || COLORS.textLight;
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending_manager_review: 'PM Onayı Bekliyor',
      pending_operations_approval: 'Operasyon Onayı Bekliyor',
      operations_approved: 'Faturalanmaya Hazır',
      cancelled: 'İptal',
    };
    return statusMap[status] || status;
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hakediş Detayı</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
              <Text style={styles.projectName}>{invoice.project.name}</Text>
              <Text style={styles.creatorName}>Oluşturan: {invoice.creator.full_name}</Text>
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
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  creatorName: {
    fontSize: 12,
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
});
