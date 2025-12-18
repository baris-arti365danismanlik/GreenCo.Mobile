import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Building2,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  MapPin,
} from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Invoice = {
  id: string;
  invoice_number: string;
  technical_company_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  total_jobs: number;
  job_details: Array<{
    id: string;
    title: string;
    amount: number;
    completion_date: string;
    location: string;
  }>;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'rejected';
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  notes?: string;
  technical_service_companies: {
    company_name: string;
    phone: string;
    email: string;
  } | null;
  approved_by_profile?: {
    full_name: string;
  } | null;
  rejected_by_profile?: {
    full_name: string;
  } | null;
};

const STATUS_CONFIG = {
  draft: { label: 'Taslak', color: COLORS.textSecondary, icon: FileText },
  pending: { label: 'Onay Bekliyor', color: COLORS.warning, icon: Clock },
  approved: { label: 'Onaylandı', color: COLORS.success, icon: CheckCircle },
  paid: { label: 'Ödendi', color: COLORS.primary, icon: CheckCircle },
  rejected: { label: 'Reddedildi', color: COLORS.error, icon: XCircle },
};

export default function TechnicalServiceInvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_invoices')
        .select(`
          *,
          technical_service_companies(
            company_name,
            phone,
            email
          ),
          approved_by_profile:profiles!technical_service_invoices_approved_by_fkey(full_name),
          rejected_by_profile:profiles!technical_service_invoices_rejected_by_fkey(full_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        if (Platform.OS === 'web') {
          window.alert('Hakediş bulunamadı');
        } else {
          Alert.alert('Hata', 'Hakediş bulunamadı');
        }
        router.back();
        return;
      }

      setInvoice(data);
    } catch (error) {
      console.error('Hakediş yükleme hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hakediş yüklenirken hata oluştu');
      } else {
        Alert.alert('Hata', 'Hakediş yüklenirken hata oluştu');
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (!invoice) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[invoice.status];
  const StatusIcon = statusConfig.icon;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hakediş Detayı</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
              <StatusIcon size={16} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Building2 size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {invoice.technical_service_companies?.company_name}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Calendar size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Özet</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Toplam İş Sayısı:</Text>
            <Text style={styles.summaryValue}>{invoice.total_jobs}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Toplam Tutar:</Text>
            <Text style={styles.summaryAmount}>
              {invoice.total_amount.toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
              })}{' '}
              ₺
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>İşler ({invoice.total_jobs})</Text>
          {invoice.job_details.map((job, index) => (
            <View key={job.id} style={styles.jobItem}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobNumber}>#{index + 1}</Text>
                <Text style={styles.jobTitle}>{job.title}</Text>
              </View>
              <View style={styles.jobDetails}>
                <View style={styles.jobDetailRow}>
                  <MapPin size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobDetailText}>{job.location}</Text>
                </View>
                <View style={styles.jobDetailRow}>
                  <Calendar size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobDetailText}>
                    {formatDate(job.completion_date)}
                  </Text>
                </View>
              </View>
              <Text style={styles.jobAmount}>
                {job.amount.toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                })}{' '}
                ₺
              </Text>
            </View>
          ))}
        </View>

        {invoice.approved_at && (
          <View style={[styles.card, styles.approvalCard]}>
            <CheckCircle size={20} color={COLORS.success} />
            <View style={styles.approvalInfo}>
              <Text style={styles.approvalTitle}>Onaylandı</Text>
              <Text style={styles.approvalText}>
                {invoice.approved_by_profile?.full_name} tarafından
              </Text>
              <Text style={styles.approvalDate}>{formatDateTime(invoice.approved_at)}</Text>
            </View>
          </View>
        )}

        {invoice.rejected_at && invoice.rejection_reason && (
          <View style={[styles.card, styles.rejectionCard]}>
            <XCircle size={20} color={COLORS.error} />
            <View style={styles.rejectionInfo}>
              <Text style={styles.rejectionTitle}>Reddedildi</Text>
              <Text style={styles.rejectionText}>
                {invoice.rejected_by_profile?.full_name} tarafından
              </Text>
              <Text style={styles.rejectionDate}>{formatDateTime(invoice.rejected_at)}</Text>
              <View style={styles.rejectionReasonBox}>
                <Text style={styles.rejectionReasonLabel}>Red Nedeni:</Text>
                <Text style={styles.rejectionReasonText}>{invoice.rejection_reason}</Text>
              </View>
            </View>
          </View>
        )}

        {invoice.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notlar</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Firma Bilgileri</Text>
          <View style={styles.companyInfoRow}>
            <Text style={styles.companyInfoLabel}>Telefon:</Text>
            <Text style={styles.companyInfoValue}>
              {invoice.technical_service_companies?.phone}
            </Text>
          </View>
          <View style={styles.companyInfoRow}>
            <Text style={styles.companyInfoLabel}>E-posta:</Text>
            <Text style={styles.companyInfoValue}>
              {invoice.technical_service_companies?.email}
            </Text>
          </View>
        </View>
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
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  invoiceNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  jobItem: {
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  jobNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  jobTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  jobDetails: {
    gap: 4,
    marginBottom: 8,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobDetailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  jobAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
  },
  approvalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.success + '10',
    borderColor: COLORS.success,
    borderWidth: 1,
  },
  approvalInfo: {
    flex: 1,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 4,
  },
  approvalText: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  approvalDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rejectionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.error + '10',
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  rejectionInfo: {
    flex: 1,
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  rejectionDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  rejectionReasonBox: {
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginTop: 4,
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  companyInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  companyInfoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  companyInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
});
