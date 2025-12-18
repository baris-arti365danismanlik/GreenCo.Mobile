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
import { ArrowLeft, Plus, FileText, Calendar, DollarSign, Building2, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type TechnicalServiceInvoice = {
  id: string;
  invoice_number: string;
  technical_company_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  total_jobs: number;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'rejected';
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  technical_service_companies: {
    company_name: string;
  } | null;
};

const STATUS_CONFIG = {
  draft: { label: 'Taslak', color: COLORS.textSecondary, icon: FileText },
  pending: { label: 'Onay Bekliyor', color: COLORS.warning, icon: Clock },
  approved: { label: 'Onaylandı', color: COLORS.success, icon: CheckCircle },
  paid: { label: 'Ödendi', color: COLORS.primary, icon: CheckCircle },
  rejected: { label: 'Reddedildi', color: COLORS.error, icon: XCircle },
};

export default function AdminTechnicalServiceInvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<TechnicalServiceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'pending' | 'approved' | 'paid' | 'rejected'>('all');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_invoices')
        .select(`
          *,
          technical_service_companies(company_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Hakediş yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  const getStatusCount = (status: string) => {
    if (status === 'all') return invoices.length;
    return invoices.filter((inv) => inv.status === status).length;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teknik Servis Hakedişleri</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/admin/create-technical-service-invoice')}
        >
          <Plus size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'draft', label: 'Taslak' },
            { key: 'pending', label: 'Onay Bekliyor' },
            { key: 'approved', label: 'Onaylandı' },
            { key: 'paid', label: 'Ödendi' },
            { key: 'rejected', label: 'Reddedildi' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterButton,
                filter === item.key && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(item.key as any)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === item.key && styles.filterButtonTextActive,
                ]}
              >
                {item.label} ({getStatusCount(item.key)})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content}>
        {filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Hakediş kaydı bulunamadı</Text>
          </View>
        ) : (
          filteredInvoices.map((invoice) => {
            const statusConfig = STATUS_CONFIG[invoice.status];
            const StatusIcon = statusConfig.icon;

            return (
              <TouchableOpacity
                key={invoice.id}
                style={styles.invoiceCard}
                onPress={() =>
                  router.push(`/admin/technical-service-invoice-detail?id=${invoice.id}`)
                }
              >
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceInfo}>
                    <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                    <View style={styles.companyRow}>
                      <Building2 size={14} color={COLORS.textSecondary} />
                      <Text style={styles.companyName}>
                        {invoice.technical_service_companies?.company_name}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    <StatusIcon size={16} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.invoiceDetails}>
                  <View style={styles.detailRow}>
                    <Calendar size={14} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>
                      {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <FileText size={14} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>{invoice.total_jobs} İş</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <DollarSign size={14} color={COLORS.textSecondary} />
                    <Text style={styles.amountText}>
                      {invoice.total_amount.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺
                    </Text>
                  </View>
                </View>

                {invoice.rejection_reason && (
                  <View style={styles.rejectionNote}>
                    <Text style={styles.rejectionText}>Red Nedeni: {invoice.rejection_reason}</Text>
                  </View>
                )}
              </TouchableOpacity>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginLeft: 16,
  },
  createButton: {
    padding: 8,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
  },
  filterContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: COLORS.border + '40',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  invoiceCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  companyName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  rejectionNote: {
    marginTop: 12,
    padding: 10,
    backgroundColor: COLORS.error + '10',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  rejectionText: {
    fontSize: 12,
    color: COLORS.error,
  },
});
