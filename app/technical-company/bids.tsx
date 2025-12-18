import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Stethoscope,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Bid = {
  id: string;
  bid_type: 'quote' | 'info_request' | 'diagnostic_service';
  bid_amount: number | null;
  estimated_duration: string | null;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  technical_service_requests: {
    id: string;
    title: string;
    technical_service_types: {
      name: string;
    };
  };
};

export default function MyBids() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<Bid[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [startingJob, setStartingJob] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadBids();
    }, [])
  );

  const loadBids = async () => {
    try {
      const technicalCompanyId = (profile as any)?.technical_company_id;
      console.log('Loading bids for company:', technicalCompanyId);

      if (!technicalCompanyId) {
        console.log('No company ID found');
        setLoading(false);
        return;
      }

      const { data: bidsData, error: bidsError } = await supabase
        .from('technical_service_bids')
        .select('id, bid_type, bid_amount, estimated_duration, description, status, created_at, request_id')
        .eq('company_id', technicalCompanyId)
        .order('created_at', { ascending: false });

      console.log('Loaded bids:', bidsData?.length || 0, 'bids');
      if (bidsError) {
        console.error('Bids error:', JSON.stringify(bidsError, null, 2));
        throw bidsError;
      }

      if (!bidsData || bidsData.length === 0) {
        setBids([]);
        setLoading(false);
        return;
      }

      const requestIds = bidsData.map(b => b.request_id);

      const { data: requestsData, error: requestsError } = await supabase
        .from('technical_service_requests')
        .select('id, title, service_type_id')
        .in('id', requestIds);

      if (requestsError) {
        console.error('Requests error:', JSON.stringify(requestsError, null, 2));
        throw requestsError;
      }

      const serviceTypeIds = [...new Set(requestsData?.map(r => r.service_type_id) || [])];

      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('technical_service_types')
        .select('id, name')
        .in('id', serviceTypeIds);

      if (serviceTypesError) {
        console.error('Service types error:', JSON.stringify(serviceTypesError, null, 2));
        throw serviceTypesError;
      }

      const serviceTypesMap = new Map(serviceTypesData?.map(st => [st.id, st.name]) || []);
      const requestsMap = new Map(requestsData?.map(r => [r.id, r]) || []);

      const enrichedBids = bidsData.map(bid => {
        const request = requestsMap.get(bid.request_id);
        const serviceTypeName = request ? serviceTypesMap.get(request.service_type_id) : 'Bilinmiyor';

        return {
          ...bid,
          technical_service_requests: {
            id: request?.id || '',
            title: request?.title || 'Bilinmiyor',
            technical_service_types: {
              name: serviceTypeName || 'Bilinmiyor'
            }
          }
        };
      });

      console.log('Enriched bids:', enrichedBids.length);
      setBids(enrichedBids as any);
    } catch (error) {
      console.error('Error loading bids:', error);
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

  const getBidTypeConfig = (bidType: string) => {
    switch (bidType) {
      case 'quote':
        return {
          label: 'Fiyat Teklifi',
          icon: DollarSign,
          color: '#3b82f6',
          bg: '#dbeafe',
        };
      case 'info_request':
        return {
          label: 'Bilgi Talebi',
          icon: MessageSquare,
          color: '#f59e0b',
          bg: '#fef3c7',
        };
      case 'diagnostic_service':
        return {
          label: 'Tanı Servisi',
          icon: Stethoscope,
          color: '#6366f1',
          bg: '#e0e7ff',
        };
      default:
        return {
          label: 'Teklif',
          icon: AlertCircle,
          color: COLORS.textLight,
          bg: '#f3f4f6',
        };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={18} color="#f59e0b" />;
      case 'accepted':
        return <CheckCircle size={18} color="#10b981" />;
      case 'rejected':
        return <XCircle size={18} color="#dc2626" />;
      default:
        return <AlertCircle size={18} color={COLORS.textLight} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Beklemede';
      case 'accepted':
        return 'Kabul Edildi';
      case 'rejected':
        return 'Reddedildi';
      case 'withdrawn':
        return 'Geri Çekildi';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#fef3c7';
      case 'accepted':
        return '#d1fae5';
      case 'rejected':
        return '#fee2e2';
      default:
        return '#f3f4f6';
    }
  };

  const handleStartJob = async (bid: Bid) => {
    const confirmed = window.confirm(
      `${bid.technical_service_requests.title} işine başlamak istediğinize emin misiniz?`
    );

    if (!confirmed) return;

    try {
      setStartingJob(bid.id);
      const technicalCompanyId = (profile as any)?.technical_company_id;

      const { data: existingAssignment } = await supabase
        .from('technical_service_assignments')
        .select('id')
        .eq('bid_id', bid.id)
        .maybeSingle();

      if (existingAssignment) {
        window.alert('Bu iş zaten başlatılmış!');
        router.push({
          pathname: '/technical-company/job-detail',
          params: { id: existingAssignment.id },
        });
        return;
      }

      const { data: assignment, error } = await supabase
        .from('technical_service_assignments')
        .insert({
          request_id: bid.technical_service_requests.id,
          company_id: technicalCompanyId,
          bid_id: bid.id,
          final_price: bid.bid_amount || 0,
        })
        .select()
        .single();

      if (error) throw error;

      window.alert('İş başarıyla başlatıldı! Aktif İşler sayfasına yönlendiriliyorsunuz.');
      router.push({
        pathname: '/technical-company/job-detail',
        params: { id: assignment.id },
      });
    } catch (error) {
      console.error('Error starting job:', error);
      window.alert('İş başlatılamadı: ' + (error as any).message);
    } finally {
      setStartingJob(null);
    }
  };

  const filteredBids = bids.filter((bid) => {
    if (filter === 'all') return true;
    return bid.status === filter;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Tekliflerim</Text>
          <Text style={styles.headerSub}>{bids.length} teklif</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Tümü
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text
            style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}
          >
            Beklemede
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'accepted' && styles.filterBtnActive]}
          onPress={() => setFilter('accepted')}
        >
          <Text
            style={[styles.filterText, filter === 'accepted' && styles.filterTextActive]}
          >
            Kabul
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'rejected' && styles.filterBtnActive]}
          onPress={() => setFilter('rejected')}
        >
          <Text
            style={[styles.filterText, filter === 'rejected' && styles.filterTextActive]}
          >
            Red
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filteredBids.length === 0 ? (
          <View style={styles.emptyState}>
            <DollarSign size={48} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>Teklif Bulunamadı</Text>
            <Text style={styles.emptyDesc}>
              {filter === 'all'
                ? 'Henüz teklif vermediniz'
                : 'Bu durumda teklif bulunamadı'}
            </Text>
          </View>
        ) : (
          <View style={styles.bidsList}>
            {filteredBids.map((bid) => {
              const bidTypeConfig = getBidTypeConfig(bid.bid_type);
              const BidTypeIcon = bidTypeConfig.icon;

              return (
                <View key={bid.id} style={styles.bidCard}>
                  <View style={styles.bidHeader}>
                    <View style={styles.serviceTypeBadge}>
                      <Text style={styles.serviceTypeText}>
                        {bid.technical_service_requests.technical_service_types.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(bid.status) },
                      ]}
                    >
                      {getStatusIcon(bid.status)}
                      <Text style={styles.statusText}>{getStatusText(bid.status)}</Text>
                    </View>
                  </View>

                  <View style={[styles.bidTypeRow, { backgroundColor: bidTypeConfig.bg }]}>
                    <View
                      style={[
                        styles.bidTypeIconBox,
                        { backgroundColor: bidTypeConfig.color },
                      ]}
                    >
                      <BidTypeIcon size={18} color="white" />
                    </View>
                    <Text style={[styles.bidTypeLabel, { color: bidTypeConfig.color }]}>
                      {bidTypeConfig.label}
                    </Text>
                  </View>

                <Text style={styles.bidTitle}>
                  {bid.technical_service_requests.title}
                </Text>

                {bid.bid_type === 'quote' && (
                  <View style={styles.bidDetails}>
                    <View style={styles.bidDetailItem}>
                      <DollarSign size={16} color={COLORS.textLight} />
                      <Text style={styles.bidDetailLabel}>Teklif:</Text>
                      <Text style={styles.bidDetailValue}>
                        {bid.bid_amount ? formatCurrency(bid.bid_amount) : '-'}
                      </Text>
                    </View>
                    <View style={styles.bidDetailItem}>
                      <Clock size={16} color={COLORS.textLight} />
                      <Text style={styles.bidDetailLabel}>Süre:</Text>
                      <Text style={styles.bidDetailValue}>
                        {bid.estimated_duration || '-'}
                      </Text>
                    </View>
                  </View>
                )}

                {bid.bid_type === 'diagnostic_service' && bid.bid_amount && (
                  <View style={styles.bidDetails}>
                    <View style={styles.bidDetailItem}>
                      <DollarSign size={16} color={COLORS.textLight} />
                      <Text style={styles.bidDetailLabel}>Servis Ücreti:</Text>
                      <Text style={styles.bidDetailValue}>
                        {formatCurrency(bid.bid_amount)}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.bidDesc} numberOfLines={2}>
                  {bid.description}
                </Text>

                <Text style={styles.bidDate}>Teklif Tarihi: {formatDate(bid.created_at)}</Text>

                {bid.status === 'accepted' && (
                  <TouchableOpacity
                    style={styles.startJobBtn}
                    onPress={() => handleStartJob(bid)}
                    disabled={startingJob === bid.id}
                  >
                    {startingJob === bid.id ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <CheckCircle size={18} color="white" />
                        <Text style={styles.startJobBtnText}>İşe Başla</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                </View>
              );
            })}
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
  filterRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterBtnActive: {
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
  bidsList: {
    padding: 16,
    gap: 12,
  },
  bidCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bidTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 10,
  },
  bidTypeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidTypeLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  bidTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  bidTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  bidTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  bidDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  bidDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bidDetailLabel: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  bidDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  bidDesc: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 12,
  },
  bidDate: {
    fontSize: 12,
    color: COLORS.textLight,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  startJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  startJobBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
});
