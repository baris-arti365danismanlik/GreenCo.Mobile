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
import { ArrowLeft, Building2, MapPin, FileText, Send, CheckCircle, Calendar, Users, DollarSign, MessageSquare, Stethoscope, AlertCircle, Clock } from 'lucide-react-native';
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
  companies?: {
    name: string;
  } | null;
  technical_service_types?: {
    name: string;
  } | null;
  projects_greenco?: {
    name: string;
  } | null;
};

export default function RequestDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [updating, setUpdating] = useState(false);
  const [isUserProjectManager, setIsUserProjectManager] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [bids, setBids] = useState<any[]>([]);
  const [bidStats, setBidStats] = useState<{
    count: number;
    bestBid?: {
      raw: number;
      final: number;
    };
    quoteCount: number;
    infoRequestCount: number;
    diagnosticCount: number;
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadRequest();
    }
  }, [id]);

  const loadRequest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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

      if (data?.project_id) {
        const { data: pmData } = await supabase
          .from('project_managers')
          .select('id')
          .eq('project_id', data.project_id)
          .eq('manager_id', user.id)
          .maybeSingle();

        setIsUserProjectManager(!!pmData);
      }

      // Check for Admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsUserAdmin(profile?.role === 'admin');

      if (data?.status !== 'pending_review' && data?.status !== 'info_needed') {
        const { data: bidsData } = await supabase
          .from('technical_service_bids')
          .select('*, technical_service_companies(company_name, phone, email)')
          .eq('request_id', id);

        if (bidsData) {
          setBids(bidsData);

          if (bidsData.length > 0) {
            const priceQuotes = bidsData.filter(b => b.bid_type === 'quote');
            const infoRequests = bidsData.filter(b => b.bid_type === 'info_request');
            const diagnosticServices = bidsData.filter(b => b.bid_type === 'diagnostic_service');

            // En düşük fiyatı hesapla (Komisyon dahil en uygun teklifi bul)
            let bestBid: { raw: number; final: number } | undefined;

            if (priceQuotes.length > 0) {
              // Use the customer's company commission rate
              // @ts-ignore - data.companies is already typed, but commission_rate might be null/undefined
              const commissionRate = data?.companies?.commission_rate || 0;

              const calculatedBids = priceQuotes
                .filter(b => b.bid_amount)
                .map(b => {
                  const rawAmount = b.bid_amount!;
                  // Veritabanında ondalık olarak saklanıyor (0.10)
                  const finalAmount = rawAmount * (1 + commissionRate);

                  return {
                    raw: rawAmount,
                    final: finalAmount
                  };
                });

              if (calculatedBids.length > 0) {
                // Final fiyata göre sırala ve en düşüğü al
                calculatedBids.sort((a, b) => a.final - b.final);
                bestBid = calculatedBids[0];
              }
            }

            setBidStats({
              count: bidsData.length,
              bestBid,
              quoteCount: priceQuotes.length,
              infoRequestCount: infoRequests.length,
              diagnosticCount: diagnosticServices.length,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading request:', error);
      Alert.alert('Hata', 'Talep yüklenirken hata oluştu');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending_review: 'İnceleme Bekliyor',
      info_needed: 'Bilgi Bekleniyor',
      bidding: 'Teklif Toplama',
      awaiting_customer_decision: 'Operasyon Onayı Bekleniyor',
      approved: 'Onaylandı',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal Edildi',
    };
    return labels[status] || status;
  };

  const handleStartBidding = async () => {
    console.log('handleStartBidding called');

    const confirmed = window.confirm(
      'Teknik servislere bildirim gönderilecek. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) {
      console.log('User cancelled');
      return;
    }

    try {
      console.log('Starting bidding for request:', id);
      setUpdating(true);
      const { data, error } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'bidding',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

      console.log('Update result:', { data, error });

      if (error) throw error;

      window.alert('Başarılı: Teklif toplama başlatıldı');
      await loadRequest();
      router.push('/technical/dashboard');
    } catch (error) {
      console.error('Error starting bidding:', error);
      window.alert('Hata: İşlem başarısız - ' + (error as any).message);
    } finally {
      setUpdating(false);
    }
  };

  const handleFinalizeBidding = async () => {
    const confirmed = window.confirm(
      'Teklif sürecini sonlandırıp müşteriye en uygun seçenekleri sunmak istiyor musunuz?'
    );
    if (!confirmed) return;

    try {
      setUpdating(true);

      // 1. Reset previous selections for this request
      await supabase
        .from('technical_service_bids')
        .update({
          selected_for_customer: false,
          shown_to_customer_at: null,
          is_combined_info_request: false,
          combined_from_bid_ids: null
        })
        .eq('request_id', id);

      // 2. Fetch all active bids
      const { data: bids } = await supabase
        .from('technical_service_bids')
        .select('*')
        .eq('request_id', id)
        .neq('status', 'rejected')
        .neq('status', 'withdrawn');

      if (bids && bids.length > 0) {
        const updates = [];

        // 3a. Select Lowest Price Quote
        const quoteBids = bids
          .filter(b => b.bid_type === 'quote' && b.bid_amount != null)
          .sort((a, b) => (a.bid_amount || 0) - (b.bid_amount || 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (quoteBids.length > 0) {
          updates.push(
            supabase
              .from('technical_service_bids')
              .update({ selected_for_customer: true, shown_to_customer_at: new Date().toISOString() })
              .eq('id', quoteBids[0].id)
          );
        }

        // 3b. Select Lowest Price Diagnostic
        const diagnosticBids = bids
          .filter(b => (b.bid_type === 'diagnostic' || b.bid_type === 'diagnostic_service') && b.bid_amount != null)
          .sort((a, b) => (a.bid_amount || 0) - (b.bid_amount || 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (diagnosticBids.length > 0) {
          updates.push(
            supabase
              .from('technical_service_bids')
              .update({ selected_for_customer: true, shown_to_customer_at: new Date().toISOString() })
              .eq('id', diagnosticBids[0].id)
          );
        }

        // 3c. Combine Info Requests
        const infoRequestBids = bids.filter(b => b.bid_type === 'info_request');
        if (infoRequestBids.length > 0) {
          const ids = infoRequestBids.map(b => b.id);
          const primaryBidId = ids[0];

          updates.push(
            supabase
              .from('technical_service_bids')
              .update({
                selected_for_customer: true,
                is_combined_info_request: true,
                combined_from_bid_ids: ids,
                shown_to_customer_at: new Date().toISOString()
              })
              .eq('id', primaryBidId)
          );
        }

        await Promise.all(updates);
      }

      // 4. Update request status
      const { error: updateError } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'awaiting_customer_decision',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      window.alert('Başarılı: Müşteriye en uygun seçenekler hazırlandı');
      loadRequest();
    } catch (error) {
      console.error('Error finalizing bidding:', error);
      window.alert('Hata: İşlem başarısız');
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async () => {
    console.log('handleApprove called');

    const confirmed = window.confirm(
      'Bu talep onaylanacak. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) {
      console.log('User cancelled');
      return;
    }

    try {
      console.log('Approving request:', id);
      setUpdating(true);
      const { data, error } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

      console.log('Update result:', { data, error });

      if (error) throw error;

      window.alert('Başarılı: Talep onaylandı');
      await loadRequest();
      router.push('/technical/dashboard');
    } catch (error) {
      console.error('Error approving request:', error);
      window.alert('Hata: İşlem başarısız - ' + (error as any).message);
    } finally {
      setUpdating(false);
    }
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Talep Detay</Text>
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

          {request.status === 'awaiting_customer_decision' && isUserProjectManager ? (
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
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Durum</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
              </View>
            </View>
          )}

          {/* Display Accepted Bid Details */}
          {['in_progress', 'completed', 'approved'].includes(request.status) && bids.find(b => b.status === 'accepted') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Onaylanan Teklif</Text>
              {(() => {
                const acceptedBid = bids.find(b => b.status === 'accepted');
                if (!acceptedBid) return null;
                const commissionRate = request.companies?.commission_rate || 0;
                const finalPrice = acceptedBid.bid_amount ? acceptedBid.bid_amount * (1 + commissionRate) : 0;

                return (
                  <View style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.secondary }}>
                        {acceptedBid.technical_service_companies?.company_name}
                      </Text>
                      <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: '#166534', fontSize: 12, fontWeight: '600' }}>Seçilen Firma</Text>
                      </View>
                    </View>

                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <DollarSign size={18} color={COLORS.primary} />
                        <Text style={{ color: COLORS.textLight }}>Onaylanan Tutar:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.primary }}>
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(finalPrice)}
                        </Text>
                      </View>

                      {acceptedBid.estimated_duration && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Clock size={18} color={COLORS.textLight} />
                          <Text style={{ color: COLORS.textLight }}>Tahmini Süre:</Text>
                          <Text style={{ fontSize: 15, color: COLORS.secondary, fontWeight: '500' }}>{acceptedBid.estimated_duration}</Text>
                        </View>
                      )}

                      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                        <Text style={{ fontSize: 14, color: COLORS.text }}>{acceptedBid.description}</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {request.status === 'bidding' && !isUserProjectManager && bidStats && bidStats.count > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Teklif Bilgileri</Text>
              <View style={styles.bidStatsBox}>
                <View style={styles.totalBidRow}>
                  <Users size={18} color={COLORS.primary} />
                  <Text style={styles.totalBidLabel}>Toplam Teklif Sayısı:</Text>
                  <Text style={styles.totalBidValue}>{bidStats.count}</Text>
                </View>

                <View style={styles.bidTypeBreakdown}>
                  {bidStats.quoteCount > 0 && (
                    <View style={styles.bidTypeCard}>
                      <View style={[styles.bidTypeIconLarge, { backgroundColor: '#dbeafe' }]}>
                        <DollarSign size={20} color="#3b82f6" />
                      </View>
                      <View style={styles.bidTypeInfo}>
                        <Text style={styles.bidTypeTitle}>Fiyat Teklifi</Text>
                        <Text style={styles.bidTypeValue}>{bidStats.quoteCount} teklif</Text>
                      </View>
                    </View>
                  )}

                  {bidStats.infoRequestCount > 0 && (
                    <View style={styles.bidTypeCard}>
                      <View style={[styles.bidTypeIconLarge, { backgroundColor: '#fef3c7' }]}>
                        <MessageSquare size={20} color="#f59e0b" />
                      </View>
                      <View style={styles.bidTypeInfo}>
                        <Text style={styles.bidTypeTitle}>Bilgi Talebi</Text>
                        <Text style={styles.bidTypeValue}>{bidStats.infoRequestCount} talep</Text>
                      </View>
                    </View>
                  )}

                  {bidStats.diagnosticCount > 0 && (
                    <View style={styles.bidTypeCard}>
                      <View style={[styles.bidTypeIconLarge, { backgroundColor: '#e0e7ff' }]}>
                        <Stethoscope size={20} color="#6366f1" />
                      </View>
                      <View style={styles.bidTypeInfo}>
                        <Text style={styles.bidTypeTitle}>Tanı Servisi</Text>
                        <Text style={styles.bidTypeValue}>{bidStats.diagnosticCount} servis</Text>
                      </View>
                    </View>
                  )}
                </View>

                {bidStats.bestBid && (
                  <View style={styles.minBidSection}>
                    <View style={styles.minBidRow}>
                      <View>
                        <View style={styles.minBidHeader}>
                          <DollarSign size={16} color={COLORS.textLight} />
                          <Text style={styles.minBidLabel}>Teklif Edilen (Net)</Text>
                        </View>
                        <Text style={styles.subBidAmount}>
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(bidStats.bestBid.raw)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.minBidRow}>
                      <View>
                        <View style={styles.minBidHeader}>
                          <DollarSign size={18} color={COLORS.success} />
                          <Text style={[styles.minBidLabel, { color: COLORS.success, fontWeight: '700' }]}>
                            Müşteriye Sunulacak
                          </Text>
                        </View>
                        <Text style={styles.minBidAmount}>
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                            minimumFractionDigits: 0,
                          }).format(bidStats.bestBid.final)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

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

        {request.status === 'bidding' && isUserProjectManager && (
          <View style={styles.instructionCard}>
            <AlertCircle size={20} color="#3b82f6" />
            <Text style={styles.instructionText}>
              Greenco teknik ekibimiz sizin için en uygun çözümleri değerlendiriyor. Teklifler hazır olduğunda size bilgi vereceğiz.
            </Text>
          </View>
        )}

        {request.status === 'pending_review' && isUserAdmin && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={handleStartBidding}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send size={20} color="white" />
                  <Text style={styles.primaryBtnText}>Teklif Toplamaya Başla</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={handleApprove}
              disabled={updating}
            >
              <CheckCircle size={20} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Talebi Onayla</Text>
            </TouchableOpacity>
          </View>
        )}

        {request.status === 'awaiting_customer_decision' && !isUserProjectManager && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={() => router.push({ pathname: '/technical/bids', params: { requestId: id } })}
            >
              <FileText size={20} color="white" />
              <Text style={styles.primaryBtnText}>Teklifleri İncele ve Onayla</Text>
            </TouchableOpacity>
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
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 20,
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
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
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
  actionsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  secondaryBtn: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bidStatsBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  totalBidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  totalBidLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    flex: 1,
  },
  totalBidValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bidTypeBreakdown: {
    gap: 10,
  },
  bidTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bidTypeIconLarge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidTypeInfo: {
    flex: 1,
  },
  bidTypeTitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  bidTypeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  minBidSection: {
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  minBidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  minBidLabel: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
  },
  minBidAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.success,
  },
  instructionCard: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  minBidRow: {
    paddingVertical: 4,
  },
  subBidAmount: {
    fontSize: 16,
    color: COLORS.secondary,
    fontWeight: '600',
    marginLeft: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#10b981',
    opacity: 0.3,
    marginVertical: 8,
  },
});
