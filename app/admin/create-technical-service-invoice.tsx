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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Building2,
  CheckCircle,
  Square,
  Save,
  Send,
  DollarSign,
  FileText,
} from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type TechnicalCompany = {
  id: string;
  company_name: string;
};

type CompletedJob = {
  id: string;
  final_price: number;
  completion_date: string;
  technical_service_requests: {
    id: string;
    title: string;
    location_city: string;
    location_district: string;
  } | null;
};

export default function CreateTechnicalServiceInvoiceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<TechnicalCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_companies')
        .select('id, company_name')
        .eq('is_active', true)
        .order('company_name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Firma yükleme hatası:', error);
    }
  };

  const loadJobs = async () => {
    if (!selectedCompanyId || !startDate || !endDate) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen firma ve tarih aralığı seçin');
      } else {
        Alert.alert('Uyarı', 'Lütfen firma ve tarih aralığı seçin');
      }
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('technical_service_assignments')
        .select(`
          id,
          final_price,
          completion_date,
          invoice_id,
          technical_service_requests(
            id,
            title,
            location_city,
            location_district
          )
        `)
        .eq('company_id', selectedCompanyId)
        .not('completion_date', 'is', null)
        .gte('completion_date', startDate)
        .lte('completion_date', endDate)
        .is('invoice_id', null)
        .order('completion_date', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('İş yükleme hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('İşler yüklenirken hata oluştu');
      } else {
        Alert.alert('Hata', 'İşler yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedJobIds(new Set(jobs.map((j) => j.id)));
  };

  const deselectAll = () => {
    setSelectedJobIds(new Set());
  };

  const calculateTotals = () => {
    const selectedJobs = jobs.filter((j) => selectedJobIds.has(j.id));
    const totalAmount = selectedJobs.reduce((sum, j) => sum + Number(j.final_price), 0);
    const totalJobs = selectedJobs.length;
    return { totalAmount, totalJobs };
  };

  const createInvoice = async (status: 'draft' | 'pending' | 'approved') => {
    if (selectedJobIds.size === 0) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen en az bir iş seçin');
      } else {
        Alert.alert('Uyarı', 'Lütfen en az bir iş seçin');
      }
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Kullanıcı bulunamadı');

      const selectedJobs = jobs.filter((j) => selectedJobIds.has(j.id));
      const { totalAmount, totalJobs } = calculateTotals();

      const invoiceNumber = `TS-INV-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const jobDetails = selectedJobs.map((job) => ({
        id: job.id,
        title: job.technical_service_requests?.title || 'Başlıksız',
        amount: Number(job.final_price),
        completion_date: job.completion_date,
        location: `${job.technical_service_requests?.location_district}, ${job.technical_service_requests?.location_city}`,
      }));

      const { data: invoice, error: invoiceError } = await supabase
        .from('technical_service_invoices')
        .insert({
          invoice_number: invoiceNumber,
          technical_company_id: selectedCompanyId,
          period_start: startDate,
          period_end: endDate,
          assignment_ids: Array.from(selectedJobIds),
          total_amount: totalAmount,
          total_jobs: totalJobs,
          job_details: jobDetails,
          status: status,
          created_by: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const { error: updateError } = await supabase
        .from('technical_service_assignments')
        .update({ invoice_id: invoice.id })
        .in('id', Array.from(selectedJobIds));

      if (updateError) throw updateError;

      if (Platform.OS === 'web') {
        window.alert(`Hakediş ${status === 'draft' ? 'taslak olarak kaydedildi' : 'oluşturuldu'}`);
        router.back();
      } else {
        Alert.alert(
          'Başarılı',
          `Hakediş ${status === 'draft' ? 'taslak olarak kaydedildi' : 'oluşturuldu'}`,
          [
            {
              text: 'Tamam',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Hakediş oluşturma hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hakediş oluşturulurken hata oluştu');
      } else {
        Alert.alert('Hata', 'Hakediş oluşturulurken hata oluştu');
      }
    } finally {
      setSaving(false);
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

  const { totalAmount, totalJobs } = calculateTotals();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hakediş Oluştur</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Firma Seçimi</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.companyList}>
            {companies.map((company) => (
              <TouchableOpacity
                key={company.id}
                style={[
                  styles.companyCard,
                  selectedCompanyId === company.id && styles.companyCardSelected,
                ]}
                onPress={() => {
                  setSelectedCompanyId(company.id);
                  setJobs([]);
                  setSelectedJobIds(new Set());
                }}
              >
                <Building2
                  size={20}
                  color={selectedCompanyId === company.id ? COLORS.primary : COLORS.textLight}
                />
                <Text
                  style={[
                    styles.companyCardText,
                    selectedCompanyId === company.id && styles.companyCardTextSelected,
                  ]}
                >
                  {company.company_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarih Aralığı</Text>
          <View style={styles.dateInputsRow}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Başlangıç</Text>
              <View style={styles.dateInputWrapper}>
                <Calendar size={16} color={COLORS.textLight} />
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textLight}
                  value={startDate}
                  onChangeText={setStartDate}
                  maxLength={10}
                />
              </View>
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Bitiş</Text>
              <View style={styles.dateInputWrapper}>
                <Calendar size={16} color={COLORS.textLight} />
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textLight}
                  value={endDate}
                  onChangeText={setEndDate}
                  maxLength={10}
                />
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.loadButton, (!selectedCompanyId || !startDate || !endDate) && styles.loadButtonDisabled]}
          onPress={loadJobs}
          disabled={!selectedCompanyId || !startDate || !endDate || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <FileText size={20} color="#FFF" />
              <Text style={styles.loadButtonText}>İşleri Getir</Text>
            </>
          )}
        </TouchableOpacity>

        {jobs.length > 0 && (
          <>
            <View style={styles.section}>
              <View style={styles.jobsHeader}>
                <Text style={styles.sectionTitle}>
                  Tamamlanmış İşler ({jobs.length})
                </Text>
                <View style={styles.selectionButtons}>
                  <TouchableOpacity style={styles.selectionButton} onPress={selectAll}>
                    <Text style={styles.selectionButtonText}>Tümünü Seç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.selectionButton} onPress={deselectAll}>
                    <Text style={styles.selectionButtonText}>Temizle</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {jobs.map((job) => {
                const isSelected = selectedJobIds.has(job.id);
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.jobCard, isSelected && styles.jobCardSelected]}
                    onPress={() => toggleJobSelection(job.id)}
                  >
                    <View style={styles.jobCardContent}>
                      {isSelected ? (
                        <CheckCircle size={20} color={COLORS.primary} />
                      ) : (
                        <Square size={20} color={COLORS.textLight} />
                      )}
                      <View style={styles.jobInfo}>
                        <Text style={styles.jobTitle}>
                          {job.technical_service_requests?.title}
                        </Text>
                        <Text style={styles.jobLocation}>
                          {job.technical_service_requests?.location_district},{' '}
                          {job.technical_service_requests?.location_city}
                        </Text>
                        <Text style={styles.jobDate}>
                          {formatDate(job.completion_date)}
                        </Text>
                      </View>
                      <Text style={styles.jobAmount}>
                        {Number(job.final_price).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        ₺
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Özet</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Seçilen İş Sayısı:</Text>
                <Text style={styles.summaryValue}>{totalJobs}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Toplam Tutar:</Text>
                <Text style={styles.summaryAmount}>
                  {totalAmount.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  ₺
                </Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.draftButton]}
                onPress={() => createInvoice('draft')}
                disabled={saving || selectedJobIds.size === 0}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <>
                    <Save size={20} color={COLORS.primary} />
                    <Text style={styles.draftButtonText}>Taslak Kaydet</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.submitButton]}
                onPress={() => createInvoice('approved')}
                disabled={saving || selectedJobIds.size === 0}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <CheckCircle size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Hakediş Oluştur</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {jobs.length === 0 && selectedCompanyId && startDate && endDate && !loading && (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>
              Seçilen kriterlere uygun tamamlanmış iş bulunamadı
            </Text>
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  companyList: {
    flexDirection: 'row',
  },
  companyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  companyCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  companyCardText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  companyCardTextSelected: {
    color: COLORS.primary,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },
  loadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    marginBottom: 20,
  },
  loadButtonDisabled: {
    opacity: 0.5,
  },
  loadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  jobsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
  },
  selectionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.primary,
  },
  jobCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  jobCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  jobCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  jobLocation: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  jobDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  jobAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  summaryCard: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  draftButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  draftButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
