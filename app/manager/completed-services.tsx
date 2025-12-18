import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Star,
  Wrench,
  MapPin,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CompletedService = {
  id: string;
  final_price: number;
  completion_date: string;
  pm_approved: boolean;
  pm_rating: number | null;
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
    company_name: string;
  } | null;
};

export default function CompletedServices() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<CompletedService[]>([]);
  const [filter, setFilter] = useState<'all' | 'evaluated' | 'pending'>('all');

  const loadServices = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projects } = await supabase
        .from('project_managers')
        .select('project_id')
        .eq('manager_id', user.id);

      if (!projects || projects.length === 0) {
        setServices([]);
        return;
      }

      const projectIds = projects.map(p => p.project_id);

      const { data, error } = await supabase
        .from('technical_service_assignments')
        .select(`
          id,
          final_price,
          completion_date,
          pm_approved,
          pm_rating,
          pm_evaluated_at,
          technical_service_requests!inner(
            id,
            title,
            location_city,
            location_district,
            project_id,
            technical_service_types(name)
          ),
          technical_service_companies(
            company_name
          )
        `)
        .not('completion_date', 'is', null)
        .in('technical_service_requests.project_id', projectIds)
        .order('completion_date', { ascending: false });

      if (error) throw error;

      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadServices();
    }, [loadServices])
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredServices = services.filter((service) => {
    if (filter === 'evaluated') return service.pm_evaluated_at !== null;
    if (filter === 'pending') return service.pm_evaluated_at === null;
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tamamlanan Hizmetler</Text>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
            Tümü ({services.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterButtonText, filter === 'pending' && styles.filterButtonTextActive]}>
            Bekleyen ({services.filter(s => !s.pm_evaluated_at).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'evaluated' && styles.filterButtonActive]}
          onPress={() => setFilter('evaluated')}
        >
          <Text style={[styles.filterButtonText, filter === 'evaluated' && styles.filterButtonTextActive]}>
            Değerlendirilen ({services.filter(s => s.pm_evaluated_at).length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredServices.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Tamamlanan hizmet bulunamadı</Text>
          </View>
        ) : (
          filteredServices.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() =>
                router.push(`/manager/technical-service-evaluation?id=${service.id}`)
              }
            >
              <View style={styles.serviceHeader}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceTitle}>
                    {service.technical_service_requests?.title}
                  </Text>
                  <View style={styles.serviceSubInfo}>
                    <Wrench size={14} color={COLORS.textSecondary} />
                    <Text style={styles.serviceType}>
                      {service.technical_service_requests?.technical_service_types?.name}
                    </Text>
                  </View>
                </View>
                {service.pm_evaluated_at ? (
                  <View style={styles.evaluatedBadge}>
                    <CheckCircle size={16} color={COLORS.success} />
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <AlertCircle size={16} color={COLORS.warning} />
                  </View>
                )}
              </View>

              <View style={styles.serviceDetails}>
                <View style={styles.detailRow}>
                  <MapPin size={14} color={COLORS.textSecondary} />
                  <Text style={styles.detailText}>
                    {service.technical_service_requests?.location_district},{' '}
                    {service.technical_service_requests?.location_city}
                  </Text>
                </View>

                {service.technical_service_companies && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Firma:</Text>
                    <Text style={styles.detailText}>
                      {service.technical_service_companies.company_name}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Calendar size={14} color={COLORS.textSecondary} />
                  <Text style={styles.detailText}>
                    {formatDate(service.completion_date)}
                  </Text>
                </View>
              </View>

              {service.pm_rating && (
                <View style={styles.ratingRow}>
                  <Star size={16} color={COLORS.warning} fill={COLORS.warning} />
                  <Text style={styles.ratingText}>{service.pm_rating}/5</Text>
                </View>
              )}

              {!service.pm_evaluated_at && (
                <View style={styles.actionHint}>
                  <Text style={styles.actionHintText}>
                    Değerlendirme için tıklayın
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
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
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  serviceCard: {
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
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  serviceSubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceType: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  evaluatedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionHint: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionHintText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
});
