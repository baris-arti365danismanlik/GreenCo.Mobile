import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  Stethoscope,
  MapPin,
  Building2,
  FileText,
  Send,
  XCircle,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DiagnosticJob = {
  id: string;
  title: string;
  description: string;
  location_city: string;
  location_district: string;
  location_address: string;
  diagnostic_report: string | null;
  created_at: string;
  technical_service_types: {
    name: string;
  };
  companies: {
    name: string;
  };
  projects_greenco?: {
    name: string;
  } | null;
};

export default function DiagnosticJobs() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<DiagnosticJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<DiagnosticJob | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [partsList, setPartsList] = useState<string[]>([]);
  const [newPart, setNewPart] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const technicalCompanyId = (profile as any)?.technical_company_id;

      if (!technicalCompanyId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('technical_service_requests')
        .select(`
          id,
          title,
          description,
          location_city,
          location_district,
          location_address,
          diagnostic_report,
          created_at,
          selected_bid_id,
          technical_service_types(name),
          companies(name),
          projects_greenco(name)
        `)
        .eq('status', 'diagnostic_in_progress')
        .order('created_at', { ascending: false });

      if (data) {
        const myJobs = await Promise.all(
          data.map(async (job: any) => {
            const { data: bid } = await supabase
              .from('technical_service_bids')
              .select('company_id')
              .eq('id', job.selected_bid_id)
              .maybeSingle();

            return bid?.company_id === technicalCompanyId ? job : null;
          })
        );

        setJobs(myJobs.filter(Boolean) as DiagnosticJob[]);
      }
    } catch (error) {
      console.error('Error loading diagnostic jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReportModal = (job: DiagnosticJob) => {
    setSelectedJob(job);
    setDiagnosticReport(job.diagnostic_report || '');
    setShowReportModal(true);
  };

  const handleAddPart = () => {
    if (newPart.trim()) {
      setPartsList([...partsList, newPart.trim()]);
      setNewPart('');
    }
  };

  const handleRemovePart = (index: number) => {
    setPartsList(partsList.filter((_, i) => i !== index));
  };

  const submitReport = async () => {
    if (!diagnosticReport.trim()) {
      window.alert('Lütfen tanı raporunu girin');
      return;
    }

    if (!selectedJob) return;

    const confirmed = window.confirm(
      'Tanı raporu gönderilecek ve talep tekrar teklif toplama aşamasına geçecek. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);

      let finalReport = diagnosticReport;
      if (partsList.length > 0) {
        finalReport += '\n\n--- Değiştirilecek Parçalar ---\n';
        partsList.forEach(part => {
          finalReport += `• ${part}\n`;
        });
      }

      const { error } = await supabase
        .from('technical_service_requests')
        .update({
          diagnostic_report: finalReport,
          status: 'bidding',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedJob.id);

      if (error) throw error;

      window.alert('Başarılı: Tanı raporu gönderildi. Talep tekrar teklif toplama aşamasına geçti');
      setShowReportModal(false);
      setSelectedJob(null);
      setDiagnosticReport('');
      setPartsList([]);
      setNewPart('');
      loadJobs();
    } catch (error) {
      console.error('Error submitting report:', error);
      window.alert('Hata: Rapor gönderilirken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tanı Servisi İşleri</Text>
      </View>

      <ScrollView style={styles.content}>
        {jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Stethoscope size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Aktif tanı servisi işi yok</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <View key={job.id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View style={styles.serviceTypeBadge}>
                  <Stethoscope size={16} color="#6366f1" />
                  <Text style={styles.serviceTypeText}>
                    {job.technical_service_types?.name || 'Bilinmiyor'}
                  </Text>
                </View>
              </View>

              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobDescription} numberOfLines={2}>
                {job.description}
              </Text>

              <View style={styles.infoRow}>
                <Building2 size={16} color={COLORS.textLight} />
                <Text style={styles.infoText}>{job.companies?.name || '-'}</Text>
              </View>

              {job.projects_greenco && (
                <View style={styles.infoRow}>
                  <FileText size={16} color={COLORS.textLight} />
                  <Text style={styles.infoText}>{job.projects_greenco?.name || '-'}</Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <MapPin size={16} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  {job.location_district}, {job.location_city}
                </Text>
              </View>

              {job.diagnostic_report && (
                <View style={styles.reportPreview}>
                  <Text style={styles.reportPreviewLabel}>Mevcut Rapor:</Text>
                  <Text style={styles.reportPreviewText} numberOfLines={2}>
                    {job.diagnostic_report}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => openReportModal(job)}
              >
                <FileText size={18} color="white" />
                <Text style={styles.reportBtnText}>
                  {job.diagnostic_report ? 'Raporu Güncelle' : 'Rapor Yaz'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Tanı Raporu</Text>
              <Text style={styles.modalSubtitle}>{selectedJob?.title}</Text>

              <View style={styles.originalDescBox}>
                <Text style={styles.originalDescLabel}>Talep Açıklaması:</Text>
                <Text style={styles.originalDescText}>{selectedJob?.description}</Text>
              </View>

              <Text style={styles.inputLabel}>Tanı Raporu *</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Tespit ettiğiniz sorunu detaylı olarak açıklayın..."
                value={diagnosticReport}
                onChangeText={setDiagnosticReport}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <View style={styles.partsSection}>
                <Text style={styles.inputLabel}>Değiştirilecek Parçalar</Text>

                <View style={styles.addPartContainer}>
                  <TextInput
                    style={styles.partInput}
                    placeholder="Parça adı girin..."
                    value={newPart}
                    onChangeText={setNewPart}
                  />
                  <TouchableOpacity
                    style={styles.addPartBtn}
                    onPress={handleAddPart}
                  >
                    <Text style={styles.addPartBtnText}>Ekle</Text>
                  </TouchableOpacity>
                </View>

                {partsList.length > 0 && (
                  <View style={styles.partsList}>
                    {partsList.map((part, index) => (
                      <View key={index} style={styles.partItem}>
                        <Text style={styles.partItemText}>• {part}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemovePart(index)}
                          style={styles.removePartBtn}
                        >
                          <XCircle size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setShowReportModal(false)}
                  disabled={submitting}
                >
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.submitBtn]}
                  onPress={submitReport}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Send size={18} color="white" />
                      <Text style={styles.submitBtnText}>Gönder</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
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
  jobCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  serviceTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  jobDescription: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  reportPreview: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  reportPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  reportPreviewText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  reportBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 16,
  },
  originalDescBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  originalDescLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  originalDescText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 180,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
  partsSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  addPartContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  partInput: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  addPartBtn: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPartBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  partsList: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  partItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: 'white',
  },
  partItemText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  removePartBtn: {
    padding: 4,
  },
});
