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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Clock,
  FileText,
  MessageCircle,
  Stethoscope,
  CheckCircle,
  Send,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Bid = {
  id: string;
  bid_amount: number | null;
  estimated_duration: string | null;
  description: string;
  status: string;
  bid_type: 'quote' | 'info_request' | 'diagnostic_service';
  created_at: string;
  selected_for_customer: boolean;
  technical_service_companies: {
    company_name: string;
    phone: string;
    email: string;
    average_rating: number;
  } | null;
};

export default function BidsPage() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<Bid[]>([]);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [autoSelectedBids, setAutoSelectedBids] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [isUserProjectManager, setIsUserProjectManager] = useState(false);

  const userRole = profile?.role || '';
  const canApproveBids = userRole === 'admin' || userRole === 'operations';

  useEffect(() => {
    loadData();
  }, [requestId]);

  const getAutoSelectedBids = (allBids: Bid[]): Set<string> => {
    const selected = new Set<string>();

    const priceQuotes = allBids.filter(b => b.bid_type === 'quote' && b.bid_amount);
    if (priceQuotes.length > 0) {
      const lowestPrice = Math.min(...priceQuotes.map(b => b.bid_amount!));
      const lowestBid = priceQuotes.find(b => b.bid_amount === lowestPrice);
      if (lowestBid) selected.add(lowestBid.id);
    }

    const diagnosticServices = allBids.filter(b => b.bid_type === 'diagnostic_service' && b.bid_amount);
    if (diagnosticServices.length > 0) {
      const lowestDiagnostic = Math.min(...diagnosticServices.map(b => b.bid_amount!));
      const lowestDiagnosticBid = diagnosticServices.find(b => b.bid_amount === lowestDiagnostic);
      if (lowestDiagnosticBid) selected.add(lowestDiagnosticBid.id);
    }

    const infoRequests = allBids.filter(b => b.bid_type === 'info_request');
    infoRequests.forEach(bid => selected.add(bid.id));

    return selected;
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [bidsRes, requestRes] = await Promise.all([
        supabase
          .from('technical_service_bids')
          .select(`
            *,
            technical_service_companies(company_name, phone, email, average_rating)
          `)
          .eq('request_id', requestId)
          .order('bid_amount', { ascending: true, nullsFirst: false }),
        supabase
          .from('technical_service_requests')
          .select('title, status, project_id')
          .eq('id', requestId)
          .single(),
      ]);

      if (bidsRes.data) {
        setBids(bidsRes.data);
        const autoSelected = getAutoSelectedBids(bidsRes.data);
        setAutoSelectedBids(autoSelected);
      }
      if (requestRes.data) {
        setRequestTitle(requestRes.data.title);
        setRequestStatus(requestRes.data.status);

        if (requestRes.data.project_id) {
          const { data: pmData } = await supabase
            .from('project_managers')
            .select('id')
            .eq('project_id', requestRes.data.project_id)
            .eq('manager_id', user.id)
            .maybeSingle();

          setIsUserProjectManager(!!pmData);
        }
      }
    } catch (error) {
      console.error('Error loading bids:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToCustomer = async () => {
    if (autoSelectedBids.size === 0) {
      Alert.alert('Uyarı', 'İletilebilecek teklif bulunamadı');
      return;
    }

    const confirmed = window.confirm(
      `${autoSelectedBids.size} teklif otomatik seçildi ve müşteriye iletilecek. Devam etmek istiyor musunuz?`
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);

      const updatePromises = bids.map(bid =>
        supabase
          .from('technical_service_bids')
          .update({ selected_for_customer: autoSelectedBids.has(bid.id) })
          .eq('id', bid.id)
      );

      await Promise.all(updatePromises);

      const { error: requestError } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'awaiting_customer_decision',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      Alert.alert('Başarılı', 'Seçilen teklifler müşteriye iletildi');
      router.back();
    } catch (error) {
      console.error('Error submitting bids:', error);
      Alert.alert('Hata', 'Teklifler iletilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    const confirmed = window.confirm(
      'Bu teklifi kabul ediyor musunuz? Diğer teklifler reddedilecektir.'
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);

      const acceptPromise = supabase
        .from('technical_service_bids')
        .update({ status: 'accepted' })
        .eq('id', bidId);

      const rejectPromises = displayBids
        .filter(b => b.id !== bidId)
        .map(bid =>
          supabase
            .from('technical_service_bids')
            .update({ status: 'rejected' })
            .eq('id', bid.id)
        );

      await Promise.all([acceptPromise, ...rejectPromises]);

      const { error: requestError } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      Alert.alert('Başarılı', 'Teklif kabul edildi. İş başlatıldı.');
      router.push('/technical/dashboard');
    } catch (error) {
      console.error('Error accepting bid:', error);
      Alert.alert('Hata', 'Teklif kabul edilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const getBidStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#fef3c7', text: '#f59e0b' };
      case 'accepted':
        return { bg: '#d1fae5', text: '#10b981' };
      case 'rejected':
        return { bg: '#fee2e2', text: '#ef4444' };
      default:
        return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const getBidStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Beklemede';
      case 'accepted':
        return 'Kabul Edildi';
      case 'rejected':
        return 'Reddedildi';
      default:
        return status;
    }
  };

  const isReadOnly = requestStatus === 'awaiting_customer_decision';
  const showOnlySelected = isReadOnly || isUserProjectManager;

  const displayBids = showOnlySelected
    ? bids.filter(b => b.selected_for_customer)
    : bids;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isReadOnly ? 'Çözüm Opsiyonları' : 'Gelen Teklifler'}
          </Text>
          <Text style={styles.headerSubtitle}>{requestTitle}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <ScrollView style={styles.content}>
            {isReadOnly && !canApproveBids && (
              <View style={styles.infoCard}>
                <CheckCircle size={20} color="#8b5cf6" />
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>Operasyon Değerlendirmesinde</Text>
                  <Text style={styles.infoCardText}>
                    Alınan teklifler operasyon yöneticisi tarafından değerlendiriliyor. Uygun teklif
                    seçildikten sonra sizinle iletişime geçilecektir.
                  </Text>
                </View>
              </View>
            )}

            {displayBids.length === 0 ? (
              <View style={styles.emptyState}>
                <FileText size={48} color={COLORS.textLight} />
                <Text style={styles.emptyText}>
                  {isReadOnly ? 'Henüz seçilmiş teklif yok' : 'Henüz teklif yok'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {isReadOnly
                    ? 'Teklif süreci sonlandırıldığında en uygun seçenekler burada görünecektir'
                    : 'Teknisyen firmalar teklif verdiğinde burada görünecektir'}
                </Text>
              </View>
            ) : (
              <>
                {!isReadOnly && !isUserProjectManager && autoSelectedBids.size > 0 && (
                  <View style={styles.autoSelectBox}>
                    <View style={styles.autoSelectHeader}>
                      <CheckCircle size={20} color={COLORS.primary} />
                      <Text style={styles.autoSelectTitle}>
                        Otomatik Seçim: {autoSelectedBids.size} Teklif
                      </Text>
                    </View>
                    <Text style={styles.autoSelectText}>
                      Aşağıdaki kriterlerle otomatik seçim yapılacak:
                    </Text>
                    <View style={styles.criteriaList}>
                      <Text style={styles.criteriaItem}>• En düşük fiyat teklifi</Text>
                      <Text style={styles.criteriaItem}>• En düşük tanı servisi teklifi</Text>
                      <Text style={styles.criteriaItem}>• Tüm bilgi talepleri</Text>
                    </View>
                  </View>
                )}

                {displayBids.map((bid) => {
                  const isAutoSelected = autoSelectedBids.has(bid.id);
                  const statusColor = getBidStatusColor(bid.status);

                  const getBidTypeConfig = () => {
                    switch (bid.bid_type) {
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
                          icon: MessageCircle,
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
                          icon: FileText,
                          color: COLORS.textLight,
                          bg: '#f3f4f6',
                        };
                    }
                  };

                  const bidTypeConfig = getBidTypeConfig();
                  const BidTypeIcon = bidTypeConfig.icon;

                  return (
                    <View
                      key={bid.id}
                      style={[
                        styles.bidCard,
                        isAutoSelected && !isReadOnly && styles.bidCardSelected,
                      ]}
                    >
                      <View style={styles.bidHeader}>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                          {isAutoSelected && !isReadOnly && !isUserProjectManager && (
                            <View style={styles.selectedBadge}>
                              <CheckCircle size={16} color="white" />
                              <Text style={styles.selectedBadgeText}>Seçildi</Text>
                            </View>
                          )}
                          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                            <Text style={[styles.statusText, { color: statusColor.text }]}>
                              {getBidStatusLabel(bid.status)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={[styles.bidTypeBadge, { backgroundColor: bidTypeConfig.bg }]}>
                        <View style={[styles.bidTypeIconContainer, { backgroundColor: bidTypeConfig.color }]}>
                          <BidTypeIcon size={16} color="white" />
                        </View>
                        <Text style={[styles.bidTypeText, { color: bidTypeConfig.color }]}>
                          {bidTypeConfig.label}
                        </Text>
                      </View>

                      <View style={styles.bidDetails}>
                        {bid.bid_amount !== null && (
                          <View style={styles.bidRow}>
                            <DollarSign size={18} color={COLORS.textLight} />
                            <Text style={styles.bidLabel}>Teklif Tutarı:</Text>
                            <Text style={styles.bidValue}>₺{bid.bid_amount.toLocaleString('tr-TR')}</Text>
                          </View>
                        )}

                        {bid.estimated_duration && (
                          <View style={styles.bidRow}>
                            <Clock size={18} color={COLORS.textLight} />
                            <Text style={styles.bidLabel}>Tahmini Süre:</Text>
                            <Text style={styles.bidValue}>{bid.estimated_duration}</Text>
                          </View>
                        )}

                        <View style={styles.descriptionSection}>
                          <FileText size={18} color={COLORS.textLight} />
                          <View style={styles.descriptionContent}>
                            <Text style={styles.descriptionLabel}>
                              {bid.bid_type === 'info_request' ? 'İstenen Bilgi:' : 'Açıklama:'}
                            </Text>
                            <Text style={styles.descriptionText}>{bid.description}</Text>
                          </View>
                        </View>
                      </View>

                      <Text style={styles.bidDate}>
                        {new Date(bid.created_at).toLocaleString('tr-TR')}
                      </Text>

                      {isReadOnly && canApproveBids && bid.status === 'pending' && (
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => handleAcceptBid(bid.id)}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <ActivityIndicator color="white" size="small" />
                          ) : (
                            <>
                              <CheckCircle size={18} color="white" />
                              <Text style={styles.acceptBtnText}>Bu Teklifi Kabul Et</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          {!isReadOnly && !isUserProjectManager && !canApproveBids && bids.length > 0 && autoSelectedBids.size > 0 && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmitToCustomer}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Send size={20} color="white" />
                    <Text style={styles.submitBtnText}>
                      Müşteriye İlet ({autoSelectedBids.size} Teklif)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  autoSelectBox: {
    backgroundColor: '#d1fae5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  autoSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  autoSelectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },
  autoSelectText: {
    fontSize: 14,
    color: '#047857',
    marginBottom: 8,
  },
  criteriaList: {
    gap: 4,
  },
  criteriaItem: {
    fontSize: 13,
    color: '#047857',
  },
  bidCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  bidCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4',
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bidTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  bidTypeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidTypeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  bidDetails: {
    gap: 12,
  },
  bidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bidLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    flex: 1,
  },
  bidValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  descriptionSection: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  descriptionContent: {
    flex: 1,
  },
  descriptionLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  bidDate: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 12,
    textAlign: 'right',
  },
  actionBar: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 16,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
});
