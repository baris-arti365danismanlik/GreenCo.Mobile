import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  DollarSign,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Assignment = {
  id: string;
  final_price: number;
  completion_date: string | null;
  created_at: string;
  technical_service_requests: {
    id: string;
    title: string;
    location_city: string;
    location_district: string;
    technical_service_types: {
      name: string;
    };
  };
};

export default function ActiveJobs() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<Assignment[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Assignment[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

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

      const { data: active } = await supabase
        .from('technical_service_assignments')
        .select(`
          id,
          final_price,
          completion_date,
          created_at,
          technical_service_requests(
            id,
            title,
            location_city,
            location_district,
            technical_service_types(name)
          )
        `)
        .eq('company_id', technicalCompanyId)
        .is('completion_date', null)
        .order('created_at', { ascending: false });

      const { data: completed } = await supabase
        .from('technical_service_assignments')
        .select(`
          id,
          final_price,
          completion_date,
          created_at,
          technical_service_requests(
            id,
            title,
            location_city,
            location_district,
            technical_service_types(name)
          )
        `)
        .eq('company_id', technicalCompanyId)
        .not('completion_date', 'is', null)
        .order('completion_date', { ascending: false })
        .limit(20);

      setActiveJobs(active || []);
      setCompletedJobs(completed || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const displayJobs = showCompleted ? completedJobs : activeJobs;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>İşlerim</Text>
          <Text style={styles.headerSub}>
            {activeJobs.length} aktif, {completedJobs.length} tamamlanmış
          </Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, !showCompleted && styles.tabActive]}
          onPress={() => setShowCompleted(false)}
        >
          <Clock size={18} color={!showCompleted ? COLORS.primary : COLORS.textLight} />
          <Text style={[styles.tabText, !showCompleted && styles.tabTextActive]}>
            Aktif İşler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, showCompleted && styles.tabActive]}
          onPress={() => setShowCompleted(true)}
        >
          <CheckCircle
            size={18}
            color={showCompleted ? COLORS.primary : COLORS.textLight}
          />
          <Text style={[styles.tabText, showCompleted && styles.tabTextActive]}>
            Tamamlanan
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : displayJobs.length === 0 ? (
          <View style={styles.emptyState}>
            {showCompleted ? (
              <CheckCircle size={48} color={COLORS.textLight} />
            ) : (
              <Clock size={48} color={COLORS.textLight} />
            )}
            <Text style={styles.emptyTitle}>İş Bulunamadı</Text>
            <Text style={styles.emptyDesc}>
              {showCompleted ? 'Henüz tamamlanmış iş yok' : 'Aktif işiniz bulunmuyor'}
            </Text>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {displayJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() =>
                  router.push({
                    pathname: '/technical-company/job-detail',
                    params: { id: job.id },
                  })
                }
              >
                <View style={styles.jobHeader}>
                  <View style={styles.serviceTypeBadge}>
                    <Text style={styles.serviceTypeText}>
                      {job.technical_service_requests.technical_service_types.name}
                    </Text>
                  </View>
                  {job.completion_date && (
                    <View style={styles.completedBadge}>
                      <CheckCircle size={14} color="#10b981" />
                      <Text style={styles.completedText}>Tamamlandı</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.jobTitle}>
                  {job.technical_service_requests.title}
                </Text>

                <View style={styles.jobMeta}>
                  <View style={styles.metaItem}>
                    <DollarSign size={16} color={COLORS.textLight} />
                    <Text style={styles.metaValue}>{formatCurrency(job.final_price)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MapPin size={16} color={COLORS.textLight} />
                    <Text style={styles.metaValue}>
                      {job.technical_service_requests.location_city}
                    </Text>
                  </View>
                </View>

                <View style={styles.jobFooter}>
                  <View style={styles.dateRow}>
                    <Calendar size={14} color={COLORS.textLight} />
                    <Text style={styles.dateText}>
                      {job.completion_date
                        ? `Tamamlandı: ${formatDate(job.completion_date)}`
                        : `Başlangıç: ${formatDate(job.created_at)}`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  headerSub: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  jobsList: {
    padding: 16,
    gap: 12,
  },
  jobCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTypeBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  serviceTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  completedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  jobMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  jobFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
});
