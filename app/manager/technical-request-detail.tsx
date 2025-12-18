import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  Building2,
  MapPin,
  FileText,
  DollarSign,
  Stethoscope,
  Calendar,
  AlertCircle,
  Clock,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Request = {
  id: string;
  title: string;
  description: string;
  status: string;
  location_city: string;
  location_district: string;
  location_address: string;
  created_at: string;
  diagnostic_report?: string | null;
  companies?: {
    name: string;
    commission_rate: number;
  } | null;
  technical_service_types?: {
    name: string;
  } | null;
  projects_greenco?: {
    name: string;
  } | null;
};

type Bid = {
  id: string;
  bid_amount: number | null;
  proposed_price: number | null;
  estimated_duration: string | null;
  description: string;
  bid_type: 'quote' | 'info_request' | 'diagnostic';
  status: string;
  created_at: string;
  selected_for_customer: boolean;
  technical_service_companies: {
    id: string;
    company_name: string;
  };
};

export default function TechnicalRequestDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);

  useEffect(() => {
    if (id) {
      loadRequest();
    }
  }, [id]);

  const loadRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_requests')
        .select(`
          *,
          companies(name, commission_rate),
          technical_service_types(name),
          projects_greenco(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setRequest(data);

      if (data?.status === 'awaiting_customer_decision') {
        const { data: bidsData } = await supabase
          .from('technical_service_bids')
          .select(`
            *,
            technical_service_companies(id, company_name)
          `)
          .eq('request_id', id)
          .eq('selected_for_customer', true)
          .order('created_at', { ascending: true });

        setBids(bidsData || []);
      }
    } catch (error) {
      console.error('Error loading request:', error);
      window.alert('Hata: Talep yüklenirken hata oluştu');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPrice = (amount: number | null, commissionRate: number) => {
    if (!amount) return 0;
    return amount + (amount * commissionRate);
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending_review: 'İnceleme Bekliyor',
      info_needed: 'Bilgi Bekleniyor',
      bidding: 'Teklif Toplanıyor',
      awaiting_customer_decision: 'Operasyon Onayı Bekleniyor',
      awaiting_additional_info: 'Ek Bilgi Bekleniyor',
      diagnostic_in_progress: 'Tanı Yapılıyor',
      approved: 'Onaylandı',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal Edildi',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_review: '#f59e0b',
      info_needed: '#f59e0b',
      bidding: '#3b82f6',
      awaiting_customer_decision: '#8b5cf6',
      awaiting_additional_info: '#f59e0b',
      diagnostic_in_progress: '#6366f1',
      approved: COLORS.primary,
      in_progress: '#3b82f6',
      completed: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#f59e0b';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!request) {
    return null;
  }

  const commissionRate = request.companies?.commission_rate || 0;
  const quoteBids = bids.filter(b => b.bid_type === 'quote');
  const diagnosticBids = bids.filter(b => b.bid_type === 'diagnostic');
  const isAwaitingCustomerDecision = request.status === 'awaiting_customer_decision';
  const isBidding = request.status === 'bidding';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Talep Detayı</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{request.title}</Text>

          <View style={styles.infoRow}>
            <Building2 size={20} color={COLORS.textLight} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Firma</Text>
              <Text style={styles.infoValue}>{request.companies?.name || '-'}</Text>
            </View>
          </View>

          {request.projects_greenco && (
            <View style={styles.infoRow}>
              <FileText size={20} color={COLORS.textLight} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Proje</Text>
                <Text style={styles.infoValue}>{request.projects_greenco.name}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <FileText size={20} color={COLORS.textLight} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Hizmet Tipi</Text>
              <Text style={styles.infoValue}>{request.technical_service_types?.name || '-'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={20} color={COLORS.textLight} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Lokasyon</Text>
              <Text style={styles.infoValue}>
                {request.location_district}, {request.location_city}
              </Text>
              <Text style={styles.address}>{request.location_address}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Açıklama</Text>
            <Text style={styles.description}>{request.description}</Text>
          </View>

          {request.diagnostic_report && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tanı Raporu</Text>
              <View style={styles.reportBox}>
                <Text style={styles.reportText}>{request.diagnostic_report}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Durum</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(request.status)}20` },
              ]}
            >
              <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                {getStatusLabel(request.status)}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Talep Tarihi</Text>
            <View style={styles.dateRow}>
              <Calendar size={16} color={COLORS.textLight} />
              <Text style={styles.dateText}>
                {new Date(request.created_at).toLocaleString('tr-TR')}
              </Text>
            </View>
          </View>
        </View>

        {isBidding && (
          <View style={styles.infoCard}>
            <Clock size={20} color="#3b82f6" />
            <View style={styles.infoCardContent}>
              <Text style={styles.infoCardTitle}>Teklif Toplama Aşamasında</Text>
              <Text style={styles.infoCardText}>
                Greenco teknik ekibimiz sizin için en uygun çözümleri değerlendiriyor. Teklifler
                hazır olduğunda operasyon yöneticimiz sizinle iletişime geçecektir.
              </Text>
            </View>
          </View>
        )}

        {isAwaitingCustomerDecision && (
          <View style={styles.infoCard}>
            <AlertCircle size={20} color="#8b5cf6" />
            <View style={styles.infoCardContent}>
              <Text style={styles.infoCardTitle}>Operasyon Değerlendirmesinde</Text>
              <Text style={styles.infoCardText}>
                Alınan teklifler operasyon yöneticisi tarafından değerlendiriliyor. Uygun teklif
                seçildikten sonra sizinle iletişime geçilecektir.
              </Text>
            </View>
          </View>
        )}

        {isAwaitingCustomerDecision && bids.length > 0 && (
          <>
            {quoteBids.length > 0 && (
              <View style={styles.bidsSection}>
                <View style={styles.bidsSectionHeader}>
                  <DollarSign size={20} color={COLORS.primary} />
                  <Text style={styles.bidsSectionTitle}>
                    Tamir Teklifleri ({quoteBids.length})
                  </Text>
                </View>

                {quoteBids.map((bid) => (
                  <View key={bid.id} style={styles.bidCard}>
                    <View style={styles.bidHeader}>
                      <Text style={styles.companyName}>Greenco Yetkili Servis</Text>
                    </View>

                    <View style={styles.priceSection}>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Hizmet Bedeli:</Text>
                        <Text style={styles.priceValue}>
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(bid.proposed_price || 0)}
                        </Text>
                      </View>
                      {commissionRate > 0 && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Greenco Hizmet Bedeli:</Text>
                          <Text style={styles.priceValue}>
                            {new Intl.NumberFormat('tr-TR', {
                              style: 'currency',
                              currency: 'TRY',
                              minimumFractionDigits: 0,
                            }).format((bid.proposed_price || 0) * commissionRate)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.priceRow, styles.totalPriceRow]}>
                        <Text style={styles.totalLabel}>Toplam:</Text>
                        <Text style={styles.totalPrice}>
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(calculateTotalPrice(bid.proposed_price, commissionRate))}
                        </Text>
                      </View>
                    </View>

                    {bid.estimated_duration && (
                      <Text style={styles.duration}>Süre: {bid.estimated_duration}</Text>
                    )}

                    {bid.description && (
                      <Text style={styles.bidDescription}>{bid.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {diagnosticBids.length > 0 && (
              <View style={styles.bidsSection}>
                <View style={styles.bidsSectionHeader}>
                  <Stethoscope size={20} color="#6366f1" />
                  <Text style={styles.bidsSectionTitle}>
                    Tanı Servisi Teklifleri ({diagnosticBids.length})
                  </Text>
                </View>

                {diagnosticBids.map((bid) => (
                  <View key={bid.id} style={[styles.bidCard, { borderColor: '#6366f1' }]}>
                    <View style={styles.bidHeader}>
                      <Text style={styles.companyName}>Greenco Yetkili Servis</Text>
                    </View>

                    <View style={styles.priceSection}>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Tanı Servisi Bedeli:</Text>
                        <Text style={styles.priceValue}>
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(bid.proposed_price || 0)}
                        </Text>
                      </View>
                      {commissionRate > 0 && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Greenco Hizmet Bedeli:</Text>
                          <Text style={styles.priceValue}>
                            {new Intl.NumberFormat('tr-TR', {
                              style: 'currency',
                              currency: 'TRY',
                              minimumFractionDigits: 0,
                            }).format((bid.proposed_price || 0) * commissionRate)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.priceRow, styles.totalPriceRow]}>
                        <Text style={styles.totalLabel}>Toplam:</Text>
                        <Text style={styles.totalPrice}>
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(calculateTotalPrice(bid.proposed_price, commissionRate))}
                        </Text>
                      </View>
                    </View>

                    {bid.description && (
                      <Text style={styles.bidDescription}>{bid.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
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
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  address: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  reportBox: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  reportText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.text,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  bidsSection: {
    marginBottom: 16,
  },
  bidsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bidsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  bidCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginBottom: 12,
  },
  bidHeader: {
    marginBottom: 12,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  priceSection: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  totalPriceRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  duration: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  bidDescription: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
});
