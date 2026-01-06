import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Calendar,
  MapPin,
  Wrench,
  Package,
  DollarSign,
  Clock,
  FileText,
  Pencil,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Assignment = {
  id: string;
  final_price: number;
  completion_date: string;
  problem_description: string;
  solution_description: string;
  parts_used: string | null;
  labor_cost: number | null;
  parts_cost: number | null;
  warranty_months: number | null;
  pm_approved: boolean;
  pm_rating: number | null;
  pm_feedback: string | null;
  service_completion_status: 'satisfactory' | 'incomplete' | 'unsatisfactory' | 'requires_rework' | null;
  pm_evaluated_at: string | null;
  technical_service_requests: {
    id: string;
    title: string;
    location_city: string;
    location_district: string;
    technical_service_types: {
      name: string;
    } | null;
  } | null;
  technical_service_companies: {
    id: string;
    company_name: string;
    phone: string;
  } | null;
};

export default function TechnicalServiceEvaluation() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [completionStatus, setCompletionStatus] = useState<'satisfactory' | 'incomplete' | 'unsatisfactory' | 'requires_rework'>('satisfactory');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadAssignment();
  }, [id]);

  const loadAssignment = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_assignments')
        .select(`
          id,
          final_price,
          completion_date,
          problem_description,
          solution_description,
          parts_used,
          labor_cost,
          parts_cost,
          warranty_months,
          pm_approved,
          pm_rating,
          pm_feedback,
          service_completion_status,
          pm_evaluated_at,
          technical_service_requests(
            id,
            title,
            location_city,
            location_district,
            technical_service_types(name)
          ),
          technical_service_companies(
            id,
            company_name,
            phone
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      setAssignment(data);
      if (data.pm_rating) setRating(data.pm_rating);
      if (data.pm_feedback) setFeedback(data.pm_feedback);
      if (data.service_completion_status) setCompletionStatus(data.service_completion_status);
    } catch (error) {
      console.error('Error loading assignment:', error);
      if (Platform.OS === 'web') {
        window.alert('İş detayı yüklenirken hata oluştu');
      } else {
        Alert.alert('Hata', 'İş detayı yüklenirken hata oluştu');
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const submitEvaluation = async () => {
    if (rating === 0) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen puan verin');
      } else {
        Alert.alert('Uyarı', 'Lütfen puan verin');
      }
      return;
    }

    if (!feedback.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen değerlendirme yazın');
      } else {
        Alert.alert('Uyarı', 'Lütfen değerlendirme yazın');
      }
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('technical_service_assignments')
        .update({
          pm_rating: rating,
          pm_feedback: feedback,
          service_completion_status: completionStatus,
          pm_approved: completionStatus === 'satisfactory',
          pm_evaluated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Update company stats
      if (assignment?.technical_service_companies?.id) {
        const companyId = assignment.technical_service_companies.id;

        // Get all rated assignments for this company to calculate new average
        const { data: ratings, error: ratingError } = await supabase
          .from('technical_service_assignments')
          .select('pm_rating')
          .eq('company_id', companyId)
          .not('pm_rating', 'is', null);

        if (!ratingError && ratings) {
          const totalJobs = ratings.length;
          const averageRating = totalJobs > 0
            ? ratings.reduce((sum, item) => sum + (item.pm_rating || 0), 0) / totalJobs
            : 0;

          // Update company table
          const { error: updateError } = await supabase
            .from('technical_service_companies')
            .update({
              average_rating: averageRating,
              total_jobs: totalJobs
            })
            .eq('id', companyId);

          if (updateError) {
            console.error('Error updating company stats:', updateError);
          }
        }
      }

      if (Platform.OS === 'web') {
        window.alert('Değerlendirme kaydedildi');
        router.back();
      } else {
        Alert.alert('Başarılı', 'Değerlendirme kaydedildi', [
          {
            text: 'Tamam',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error saving evaluation:', error);
      if (Platform.OS === 'web') {
        window.alert('Değerlendirme kaydedilirken hata oluştu');
      } else {
        Alert.alert('Hata', 'Değerlendirme kaydedilirken hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'satisfactory':
        return { label: 'Tatmin Edici', icon: CheckCircle, color: COLORS.success };
      case 'incomplete':
        return { label: 'Eksik Hizmet', icon: AlertTriangle, color: COLORS.warning };
      case 'unsatisfactory':
        return { label: 'Tatmin Edici Değil', icon: XCircle, color: COLORS.error };
      case 'requires_rework':
        return { label: 'Yeniden Yapılmalı', icon: RefreshCw, color: COLORS.warning };
      default:
        return { label: status, icon: AlertTriangle, color: COLORS.textLight };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>İş bulunamadı</Text>
      </SafeAreaView>
    );
  }

  const alreadyEvaluated = assignment.pm_evaluated_at !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teknik Servis Değerlendirme</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{assignment.technical_service_requests?.title}</Text>

          <View style={styles.infoRow}>
            <Wrench size={16} color={COLORS.textLight} />
            <Text style={styles.infoText}>
              {assignment.technical_service_requests?.technical_service_types?.name}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={16} color={COLORS.textLight} />
            <Text style={styles.infoText}>
              {assignment.technical_service_requests?.location_district}, {assignment.technical_service_requests?.location_city}
            </Text>
          </View>

          {assignment.technical_service_companies && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Firma:</Text>
              <Text style={styles.infoValue}>{assignment.technical_service_companies.company_name}</Text>
            </View>
          )}

          {assignment.completion_date && (
            <View style={styles.infoRow}>
              <Calendar size={16} color={COLORS.textLight} />
              <Text style={styles.infoText}>{formatDate(assignment.completion_date)}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>İş Detayları</Text>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Tespit Edilen Sorun:</Text>
            <Text style={styles.detailValue}>{assignment.problem_description}</Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Yapılan İşlem:</Text>
            <Text style={styles.detailValue}>{assignment.solution_description}</Text>
          </View>

          {assignment.parts_used && (
            <View style={styles.detailSection}>
              <View style={styles.iconLabelRow}>
                <Package size={16} color={COLORS.textLight} />
                <Text style={styles.detailLabel}>Kullanılan Parçalar:</Text>
              </View>
              <Text style={styles.detailValue}>{assignment.parts_used}</Text>
            </View>
          )}

          <View style={styles.costRow}>
            {assignment.labor_cost !== null && (
              <View style={styles.costItem}>
                <Clock size={16} color={COLORS.textLight} />
                <Text style={styles.costLabel}>İşçilik:</Text>
                <Text style={styles.costValue}>{assignment.labor_cost.toLocaleString('tr-TR')} ₺</Text>
              </View>
            )}

            {assignment.parts_cost !== null && (
              <View style={styles.costItem}>
                <Package size={16} color={COLORS.textLight} />
                <Text style={styles.costLabel}>Parça:</Text>
                <Text style={styles.costValue}>{assignment.parts_cost.toLocaleString('tr-TR')} ₺</Text>
              </View>
            )}
          </View>

          {assignment.warranty_months !== null && (
            <View style={styles.warrantyBadge}>
              <Text style={styles.warrantyText}>{assignment.warranty_months} Ay Garanti</Text>
            </View>
          )}
        </View>

        {alreadyEvaluated && !isEditing && (
          <View style={[styles.card, styles.evaluatedCard]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.evaluatedTitle}>Değerlendirme Yapıldı</Text>
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Pencil size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.evaluatedContent}>
              <View style={styles.ratingDisplay}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={24}
                    color={star <= (assignment.pm_rating || 0) ? COLORS.warning : COLORS.border}
                    fill={star <= (assignment.pm_rating || 0) ? COLORS.warning : 'transparent'}
                  />
                ))}
              </View>
              {assignment.service_completion_status && (
                <View style={styles.statusBadge}>
                  {(() => {
                    const statusInfo = getStatusInfo(assignment.service_completion_status);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <>
                        <StatusIcon size={16} color={statusInfo.color} />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              )}
              {assignment.pm_feedback && (
                <View style={styles.feedbackDisplay}>
                  <Text style={styles.feedbackLabel}>Değerlendirme:</Text>
                  <Text style={styles.feedbackText}>{assignment.pm_feedback}</Text>
                </View>
              )}
              {assignment.pm_evaluated_at && (
                <Text style={styles.evaluatedDate}>
                  {formatDate(assignment.pm_evaluated_at)}
                </Text>
              )}
            </View>
          </View>
        )}

        {(!alreadyEvaluated || isEditing) && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Puan Verin</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                  >
                    <Star
                      size={40}
                      color={star <= rating ? COLORS.warning : COLORS.border}
                      fill={star <= rating ? COLORS.warning : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingLabel}>
                {rating > 0 ? `${rating} / 5` : 'Puan verilmedi'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Hizmet Durumu</Text>
              <View style={styles.statusOptions}>
                {[
                  { value: 'satisfactory', label: 'Tatmin Edici', icon: CheckCircle, color: COLORS.success },
                  { value: 'incomplete', label: 'Eksik Hizmet', icon: AlertTriangle, color: COLORS.warning },
                  { value: 'unsatisfactory', label: 'Tatmin Edici Değil', icon: XCircle, color: COLORS.error },
                  { value: 'requires_rework', label: 'Yeniden Yapılmalı', icon: RefreshCw, color: COLORS.warning },
                ].map((status) => {
                  const StatusIcon = status.icon;
                  const isSelected = completionStatus === status.value;
                  return (
                    <TouchableOpacity
                      key={status.value}
                      style={[
                        styles.statusOption,
                        isSelected && { backgroundColor: status.color + '20', borderColor: status.color }
                      ]}
                      onPress={() => setCompletionStatus(status.value as any)}
                    >
                      <StatusIcon size={20} color={isSelected ? status.color : COLORS.textLight} />
                      <Text style={[
                        styles.statusOptionText,
                        isSelected && { color: status.color, fontWeight: '600' }
                      ]}>
                        {status.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Değerlendirmeniz</Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="İş hakkında değerlendirmenizi yazın..."
                placeholderTextColor={COLORS.textLight}
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, saving && styles.submitButtonDisabled]}
              onPress={submitEvaluation}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <CheckCircle size={20} color="#FFF" />
                  <Text style={styles.submitButtonText}>Değerlendirmeyi Kaydet</Text>
                </>
              )}
            </TouchableOpacity>
          </>
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
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 16,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  iconLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  costRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  costItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  costLabel: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  warrantyBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  warrantyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusOptions: {
    gap: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  statusOptionText: {
    fontSize: 15,
    color: COLORS.text,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  evaluatedCard: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  evaluatedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 12,
  },
  evaluatedContent: {
    gap: 12,
  },
  ratingDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackDisplay: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
  },
  feedbackLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  evaluatedDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
});
