import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function UnitInvoicesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('unit_invoices')
        .select(`
          *,
          project:projects_greenco!inner(name, company_id),
          work_order:unit_based_work_orders(
            order_number,
            quantity,
            unit_price,
            service_type:service_types(name, unit_type)
          )
        `);

      if (profile?.company_id) {
        query = query.eq('project.company_id', profile.company_id);
      }

      const { data, error } = await query
        .in('status', ['pending_operations_approval', 'operations_approved'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Hakediş yükleme hatası:', error);
        throw error;
      }

      console.log('Operasyon hakedişleri:', data?.length || 0);
      setInvoices(data || []);
    } catch (error: any) {
      console.error('Hakediş yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_operations_approval':
        return { icon: Clock, color: COLORS.warning, text: 'Onay Bekliyor' };
      case 'operations_approved':
        return { icon: CheckCircle, color: COLORS.success, text: 'Faturalanmaya Hazır' };
      case 'submitted':
        return { icon: CheckCircle, color: COLORS.info, text: 'Gönderildi' };
      case 'paid':
        return { icon: CheckCircle, color: COLORS.primary, text: 'Ödendi' };
      case 'cancelled':
        return { icon: XCircle, color: COLORS.error, text: 'İptal' };
      default:
        return { icon: FileText, color: COLORS.textLight, text: status };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Birim Bazlı Hakedişler</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadInvoices} />
        }
      >
        {invoices.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Henüz hakediş bulunmuyor</Text>
          </View>
        )}

        {invoices.map((invoice) => {
          const statusInfo = getStatusInfo(invoice.status);
          const StatusIcon = statusInfo.icon;

          return (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceCard}
              onPress={() => router.push(`/operations/unit-invoice-detail?id=${invoice.id}`)}
            >
              <View style={styles.invoiceHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                  <Text style={styles.projectName}>{invoice.project?.name}</Text>
                  {invoice.work_order?.service_type && (
                    <Text style={styles.workOrderTitle}>
                      {invoice.work_order.service_type.name} - {invoice.work_order.quantity} {invoice.work_order.service_type.unit_type}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                  <StatusIcon size={14} color={statusInfo.color} />
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.text}
                  </Text>
                </View>
              </View>

              <View style={styles.amountBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amountLabel}>Toplam Tutar</Text>
                  {invoice.adjusted_amount != null && (
                    <View style={styles.amountComparisonRow}>
                      <Text style={styles.originalAmountText}>
                        Orijinal: ₺{invoice.total_amount.toFixed(2)}
                      </Text>
                      <Text style={styles.adjustedAmountText}>
                        Düzeltilmiş: ₺{invoice.adjusted_amount.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.amountValue}>
                  ₺{(invoice.adjusted_amount ?? invoice.total_amount).toFixed(2)}
                </Text>
              </View>

              <View style={styles.invoiceMeta}>
                <Text style={styles.metaText}>{formatDate(invoice.invoice_date)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 15,
  },
  invoiceCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  projectName: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  workOrderTitle: {
    fontSize: 13,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: COLORS.success + '10',
    borderRadius: 8,
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  amountComparisonRow: {
    marginTop: 4,
    gap: 4,
  },
  originalAmountText: {
    fontSize: 11,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  adjustedAmountText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.success,
  },
  invoiceMeta: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
});
