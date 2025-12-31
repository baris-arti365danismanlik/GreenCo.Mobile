import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import { ArrowLeft, FileText, Clock, CheckCircle, AlertCircle, Users, DollarSign, MessageSquare, Stethoscope, Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';

type Request = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  companies?: {
    name: string;
  } | null;
  technical_service_types?: {
    name: string;
  } | null;
  location_city: string;
  location_district: string;
  bid_count?: number;
  min_bid_amount?: number;
  quote_count?: number;
  info_request_count?: number;
  diagnostic_count?: number;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending_review: {
    label: 'İnceleme Bekliyor',
    color: '#f59e0b',
    bg: '#fef3c7',
    icon: AlertCircle,
  },
  info_needed: {
    label: 'Bilgi Bekleniyor',
    color: '#6366f1',
    bg: '#e0e7ff',
    icon: FileText,
  },
  bidding: {
    label: 'Teklif Toplama',
    color: '#3b82f6',
    bg: '#dbeafe',
    icon: Clock,
  },
  approved: {
    label: 'Onaylandı',
    color: '#10b981',
    bg: '#d1fae5',
    icon: CheckCircle,
  },
  in_progress: {
    label: 'Devam Ediyor',
    color: '#f59e0b',
    bg: '#fef3c7',
    icon: Clock,
  },
  completed: {
    label: 'Tamamlandı',
    color: '#10b981',
    bg: '#d1fae5',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'İptal Edildi',
    color: '#6b7280',
    bg: '#f3f4f6',
    icon: AlertCircle,
  },
};

export default function TechnicalRequests() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Safety check: specific role redirection
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'project_manager') {
          router.replace('/manager/technical-requests');
          return;
        }
      }
      loadRequests();
    };

    checkRole();
  }, []);

  const loadRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user profile for filtering
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .single();

      let query = supabase
        .from('technical_service_requests')
        .select(`
          *,
          companies(name),
          technical_service_types(name)
        `)
        .order('created_at', { ascending: false });

      // If operations, filter by company_id
      if (profile?.role === 'operations' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      setIsAdmin(profile?.role === 'admin');

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const requestsWithBidInfo = await Promise.all(
          data.map(async (req) => {
            if (req.status === 'bidding') {
              const { data: bids } = await supabase
                .from('technical_service_bids')
                .select('bid_amount, bid_type')
                .eq('request_id', req.id);

              const bidCount = bids?.length || 0;
              const priceQuotes = bids?.filter(b => b.bid_type === 'quote') || [];
              const infoRequests = bids?.filter(b => b.bid_type === 'info_request') || [];
              const diagnosticServices = bids?.filter(b => b.bid_type === 'diagnostic_service') || [];

              const minBidAmount = priceQuotes.length > 0 && priceQuotes.some(b => b.bid_amount)
                ? Math.min(...priceQuotes.filter(b => b.bid_amount).map(b => b.bid_amount!))
                : undefined;

              return {
                ...req,
                bid_count: bidCount,
                min_bid_amount: minBidAmount,
                quote_count: priceQuotes.length,
                info_request_count: infoRequests.length,
                diagnostic_count: diagnosticServices.length,
              };
            }
            return req;
          })
        );

        setRequests(requestsWithBidInfo);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesFilter = filter === 'all' || r.status === filter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      r.title?.toLowerCase().includes(searchLower) ||
      r.companies?.name?.toLowerCase().includes(searchLower) ||
      r.technical_service_types?.name?.toLowerCase().includes(searchLower) ||
      r.location_city?.toLowerCase().includes(searchLower) ||
      r.location_district?.toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending_review;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tüm Talepler</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Talep, firma veya lokasyon ara..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Tümü ({requests.length})
            </Text>
          </TouchableOpacity>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = requests.filter((r) => r.status === key).length;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, filter === key && styles.filterChipActive]}
                onPress={() => setFilter(key)}
              >
                <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
                  {config.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.content}>
          {filteredRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <FileText size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Henüz talep bulunmuyor</Text>
            </View>
          ) : (
            filteredRequests.map((request) => {
              const statusConfig = getStatusConfig(request.status);
              const Icon = statusConfig.icon;
              return (
                <TouchableOpacity
                  key={request.id}
                  style={styles.requestCard}
                  onPress={() =>
                    router.push({
                      pathname: isAdmin ? '/admin/technical-request-detail' : '/technical/request-detail',
                      params: { id: request.id },
                    })
                  }
                >
                  <View style={styles.requestHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                      <Icon size={14} color={statusConfig.color} />
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                    <Text style={styles.requestDate}>
                      {new Date(request.created_at).toLocaleDateString('tr-TR')}
                    </Text>
                  </View>

                  <Text style={styles.requestTitle}>{request.title}</Text>

                  <View style={styles.requestMeta}>
                    <Text style={styles.metaLabel}>Firma:</Text>
                    <Text style={styles.metaValue}>{request.companies?.name || '-'}</Text>
                  </View>

                  <View style={styles.requestMeta}>
                    <Text style={styles.metaLabel}>Hizmet:</Text>
                    <Text style={styles.metaValue}>{request.technical_service_types?.name || '-'}</Text>
                  </View>

                  <View style={styles.requestMeta}>
                    <Text style={styles.metaLabel}>Lokasyon:</Text>
                    <Text style={styles.metaValue}>
                      {request.location_district}, {request.location_city}
                    </Text>
                  </View>

                  {request.status === 'bidding' && request.bid_count !== undefined && request.bid_count > 0 && (
                    <View style={styles.bidInfo}>
                      {request.quote_count !== undefined && request.quote_count > 0 && (
                        <View style={styles.bidTypeItem}>
                          <View style={[styles.bidTypeIcon, { backgroundColor: '#dbeafe' }]}>
                            <DollarSign size={14} color="#3b82f6" />
                          </View>
                          <View>
                            <Text style={styles.bidTypeLabel}>Fiyat Teklifi</Text>
                            <Text style={styles.bidTypeCount}>{request.quote_count} teklif</Text>
                          </View>
                        </View>
                      )}
                      {request.info_request_count !== undefined && request.info_request_count > 0 && (
                        <View style={styles.bidTypeItem}>
                          <View style={[styles.bidTypeIcon, { backgroundColor: '#fef3c7' }]}>
                            <MessageSquare size={14} color="#f59e0b" />
                          </View>
                          <View>
                            <Text style={styles.bidTypeLabel}>Bilgi Talebi</Text>
                            <Text style={styles.bidTypeCount}>{request.info_request_count} talep</Text>
                          </View>
                        </View>
                      )}
                      {request.diagnostic_count !== undefined && request.diagnostic_count > 0 && (
                        <View style={styles.bidTypeItem}>
                          <View style={[styles.bidTypeIcon, { backgroundColor: '#e0e7ff' }]}>
                            <Stethoscope size={14} color="#6366f1" />
                          </View>
                          <View>
                            <Text style={styles.bidTypeLabel}>Tanı Servisi</Text>
                            <Text style={styles.bidTypeCount}>{request.diagnostic_count} servis</Text>
                          </View>
                        </View>
                      )}
                      {request.min_bid_amount && (
                        <View style={styles.minBidBadge}>
                          <Text style={styles.minBidLabel}>En Düşük Teklif:</Text>
                          <Text style={styles.minBidAmount}>
                            {new Intl.NumberFormat('tr-TR', {
                              style: 'currency',
                              currency: 'TRY',
                              minimumFractionDigits: 0,
                            }).format(request.min_bid_amount)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingRight: 32,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  filterTextActive: {
    color: 'white',
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
    marginTop: 16,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDate: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  requestMeta: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    width: 80,
  },
  metaValue: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    fontWeight: '500',
  },
  bidInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  bidTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  bidTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidTypeLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  bidTypeCount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  minBidBadge: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  minBidLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  minBidAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
