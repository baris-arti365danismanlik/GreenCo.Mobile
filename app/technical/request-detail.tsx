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
import { ArrowLeft, Building2, MapPin, FileText, Send, CheckCircle, Calendar, Users, DollarSign, MessageSquare, Stethoscope, AlertCircle } from 'lucide-react-native';
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
  const [bidStats, setBidStats] = useState<{
    count: number;
    minAmount?: number;
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
          companies(name),
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

      if (data?.status === 'bidding') {
        const { data: bids } = await supabase
          .from('technical_service_bids')
          .select('bid_amount, bid_type')
          .eq('request_id', id);

        if (bids && bids.length > 0) {
          const priceQuotes = bids.filter(b => b.bid_type === 'quote');
          const infoRequests = bids.filter(b => b.bid_type === 'info_request');
          const diagnosticServices = bids.filter(b => b.bid_type === 'diagnostic_service');

          const minAmount = priceQuotes.length > 0 && priceQuotes.some(b => b.bid_amount)
            ? Math.min(...priceQuotes.filter(b => b.bid_amount).map(b => b.bid_amount!))
            : undefined;

          setBidStats({
            count: bids.length,
            minAmount,
            quoteCount: priceQuotes.length,
            infoRequestCount: infoRequests.length,
            diagnosticCount: diagnosticServices.length,
          });
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

      const { data, error } = await supabase.rpc('auto_select_bids_for_customer', {
        p_request_id: id,
      });

      if (error) throw error;

      await supabase
        .from('technical_service_requests')
        .update({
          status: 'awaiting_customer_decision',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

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

                {bidStats.minAmount && (
                  <View style={styles.minBidSection}>
                    <View style={styles.minBidHeader}>
                      <DollarSign size={18} color={COLORS.success} />
                      <Text style={styles.minBidLabel}>En Düşük Fiyat Teklifi</Text>
                    </View>
                    <Text style={styles.minBidAmount}>
                      {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                        minimumFractionDigits: 0,
                      }).format(bidStats.minAmount)}
                    </Text>
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

        {request.status === 'bidding' && !isUserProjectManager && bidStats && bidStats.count > 0 && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn, { backgroundColor: COLORS.success }]}
              onPress={handleFinalizeBidding}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <CheckCircle size={20} color="white" />
                  <Text style={styles.primaryBtnText}>Teklif Sürecini Sonlandır</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {request.status === 'pending_review' && (
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
              <Text style={styles.primaryBtnText}>Seçilmiş Teklifleri Görüntüle</Text>
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
});
