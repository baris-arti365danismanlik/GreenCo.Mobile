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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  FileText,
  AlertCircle,
  Clock,
  DollarSign,
  Send,
  Users,
  MessageSquare,
  Stethoscope,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateRangePicker } from '@/components/DateRangePicker';

type BidType = 'quote' | 'info_request' | 'diagnostic_service';

type ServiceRequest = {
  id: string;
  title: string;
  description: string;
  location_city: string;
  location_district: string;
  location_address: string;
  asset_code?: string;
  asset_brands?: {
    name: string;
  } | null;
  asset_models?: {
    name: string;
  } | null;
  room_area?: string;
  floor?: string;
  send_to_authorized_service: boolean;
  warranty_end_date?: string;
  created_at: string;
  current_bid_round: number;
  technical_service_types: {
    name: string;
  };
  projects_greenco?: {
    name: string;
  } | null;
  status: string;
};

export default function RequestDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [bidType, setBidType] = useState<BidType>('quote');
  const [bidAmount, setBidAmount] = useState('');

  // New date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [bidDescription, setBidDescription] = useState('');
  const [bidStats, setBidStats] = useState<{ count: number; minAmount?: number } | null>(null);

  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_service_requests')
        .select(`
          id,
          title,
          description,
          status,
          location_city,
          location_district,
          location_address,
          asset_code,
          room_area,
          floor,
          send_to_authorized_service,
          warranty_end_date,
          created_at,
          current_bid_round,
          technical_service_types(name),
          projects_greenco(name),
          asset_brands(name),
          asset_models(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      setRequest(data);

      const { data: bids } = await supabase
        .from('technical_service_bids')
        .select('bid_amount')
        .eq('request_id', id);

      if (bids && bids.length > 0) {
        setBidStats({
          count: bids.length,
          minAmount: Math.min(...bids.map(b => b.bid_amount)),
        });
      }
    } catch (error) {
      console.error('Error loading request:', error);
      Alert.alert('Hata', 'Talep yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const submitBid = async () => {
    if (submitting) return;



    if (bidType === 'quote') {
      if (!bidAmount) {
        Alert.alert('Uyarı', 'Lütfen teklif tutarını girin');
        return;
      }
      if (!startDate || !endDate) {
        Alert.alert('Uyarı', 'Lütfen başlangıç ve bitiş tarihlerini seçin');
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        Alert.alert('Hata', 'Çalışma başlangıç tarihi, bitiş tarihinden sonra olamaz.');
        return;
      }
    }

    if (bidType === 'diagnostic_service') {
      if (!bidAmount) {
        Alert.alert('Uyarı', 'Lütfen servis ücretini girin');
        return;
      }
    }

    const technicalCompanyId = (profile as any)?.technical_company_id;

    if (!technicalCompanyId) {
      Alert.alert('Hata', 'Firma bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    setSubmitting(true);
    try {
      const currentRound = request?.current_bid_round || 1;

      const bidData: any = {
        request_id: id,
        company_id: technicalCompanyId,
        bid_type: bidType,
        bid_round: currentRound,
        description: bidDescription.trim(),
        status: 'pending',
      };

      if (bidType === 'quote') {
        bidData.bid_amount = parseFloat(bidAmount);
        // Combine dates as YYYY-MM-DD/YYYY-MM-DD
        bidData.estimated_duration = `${startDate}/${endDate}`;
      } else if (bidType === 'diagnostic_service') {
        bidData.bid_amount = parseFloat(bidAmount);
      }

      const { error } = await supabase.from('technical_service_bids').insert(bidData);

      if (error) throw error;

      // If request was in info_needed status, move it back to bidding so admin sees the new offer
      if (request?.status === 'info_needed') {
        const { error: updateError } = await supabase
          .from('technical_service_requests')
          .update({
            status: 'bidding',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) console.error('Error updating request status:', updateError);
      }

      Alert.alert('Başarılı', `Teklifiniz gönderildi (Tur ${currentRound})`);
      router.back();
    } catch (error) {
      console.error('Error submitting bid:', error);
      const errorMessage = (error as any)?.message || 'Bilinmeyen hata';
      Alert.alert('Hata', 'Gönderilirken bir hata oluştu: ' + errorMessage);
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyState}>
          <FileText size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Talep Bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Talep Detayı</Text>
          <Text style={styles.headerSub}>{request.technical_service_types?.name || 'Hizmet Bilgisi Yok'}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.serviceTypeBadge}>
              <Text style={styles.serviceTypeText}>
                {request.technical_service_types?.name || 'Bilinmeyen Hizmet'}
              </Text>
            </View>
            {request.send_to_authorized_service && (
              <View style={styles.authBadge}>
                <AlertCircle size={14} color="#dc2626" />
                <Text style={styles.authText}>Yetkili Servis</Text>
              </View>
            )}
          </View>

          <Text style={styles.requestTitle}>{request.title || 'Başlık Yok'}</Text>
          <Text style={styles.requestDesc}>{request.description || 'Açıklama Yok'}</Text>

          {bidStats && bidStats.count > 0 && (
            <View style={styles.bidStatsBox}>
              <View style={styles.bidStatItem}>
                <Users size={16} color={COLORS.primary} />
                <Text style={styles.bidStatLabel}>Teklif Sayısı:</Text>
                <Text style={styles.bidStatValue}>{bidStats.count}</Text>
              </View>
              {bidStats.minAmount && (
                <View style={styles.bidStatItem}>
                  <DollarSign size={16} color={COLORS.primary} />
                  <Text style={styles.bidStatLabel}>En Düşük Teklif:</Text>
                  <Text style={styles.bidStatValue}>
                    {new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                      minimumFractionDigits: 0,
                    }).format(bidStats.minAmount)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {request.projects_greenco?.name && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Proje</Text>
              <Text style={styles.infoValue}>{request.projects_greenco.name}</Text>
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Konum</Text>
            <View style={styles.infoRow}>
              <MapPin size={16} color={COLORS.textLight} />
              <Text style={styles.infoValue}>
                {[request.location_address, request.location_district, request.location_city]
                  .filter(Boolean)
                  .join(', ') || 'Konum Bilgisi Yok'}
              </Text>
            </View>
          </View>

          {(request.asset_brands || request.asset_code?.trim()) && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Ekipman Bilgisi</Text>
              {request.asset_brands && (
                <Text style={styles.infoValue}>
                  {`Marka/Model: ${request.asset_brands?.name || ''}${request.asset_models?.name ? ` - ${request.asset_models.name}` : ''}`}
                </Text>
              )}
              {request.asset_code?.trim() && (
                <Text style={styles.infoValue}>Varlık Kodu: {request.asset_code.trim()}</Text>
              )}
            </View>
          )}

          {(request.room_area?.trim() || request.floor?.trim()) && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Konum Detayı</Text>
              {request.room_area?.trim() && (
                <Text style={styles.infoValue}>Alan: {request.room_area.trim()}</Text>
              )}
              {request.floor?.trim() && (
                <Text style={styles.infoValue}>Kat: {request.floor.trim()}</Text>
              )}
            </View>
          )}

          {request.warranty_end_date && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Garanti Bitiş</Text>
              <Text style={styles.infoValue}>
                {formatDate(request.warranty_end_date)}
              </Text>
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Talep Tarihi</Text>
            <View style={styles.infoRow}>
              <Calendar size={16} color={COLORS.textLight} />
              <Text style={styles.infoValue}>{formatDate(request.created_at)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Teklif Ver</Text>
            {request.current_bid_round > 1 && (
              <View style={styles.roundBadge}>
                <Text style={styles.roundBadgeText}>Tur {request.current_bid_round}</Text>
              </View>
            )}
          </View>

          {request.current_bid_round > 1 && (
            <View style={styles.roundInfoBox}>
              <AlertCircle size={16} color="#3b82f6" />
              <Text style={styles.roundInfoText}>
                Bu teklif turunda sadece tamir teklifi verebilirsiniz.
              </Text>
            </View>
          )}

          <View style={styles.bidTypeSelector}>
            <TouchableOpacity
              style={[
                styles.bidTypeBtn,
                bidType === 'quote' && styles.bidTypeBtnActiveBlue,
              ]}
              onPress={() => setBidType('quote')}
            >
              <View style={[styles.bidTypeIconCircle, bidType === 'quote' && styles.iconCircleBlue]}>
                <DollarSign
                  size={18}
                  color={bidType === 'quote' ? 'white' : '#3b82f6'}
                />
              </View>
              <Text
                style={[
                  styles.bidTypeBtnText,
                  bidType === 'quote' && styles.bidTypeBtnTextBlue,
                ]}
              >
                Fiyat Teklifi
              </Text>
            </TouchableOpacity>

            {request.current_bid_round === 1 && (
              <>
                <TouchableOpacity
                  style={[
                    styles.bidTypeBtn,
                    bidType === 'info_request' && styles.bidTypeBtnActiveOrange,
                  ]}
                  onPress={() => setBidType('info_request')}
                >
                  <View style={[styles.bidTypeIconCircle, bidType === 'info_request' && styles.iconCircleOrange]}>
                    <MessageSquare
                      size={18}
                      color={bidType === 'info_request' ? 'white' : '#f59e0b'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.bidTypeBtnText,
                      bidType === 'info_request' && styles.bidTypeBtnTextOrange,
                    ]}
                  >
                    Bilgi Talebi
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bidTypeBtn,
                    bidType === 'diagnostic_service' && styles.bidTypeBtnActiveIndigo,
                  ]}
                  onPress={() => setBidType('diagnostic_service')}
                >
                  <View style={[styles.bidTypeIconCircle, bidType === 'diagnostic_service' && styles.iconCircleIndigo]}>
                    <Stethoscope
                      size={18}
                      color={bidType === 'diagnostic_service' ? 'white' : '#6366f1'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.bidTypeBtnText,
                      bidType === 'diagnostic_service' && styles.bidTypeBtnTextIndigo,
                    ]}
                  >
                    Tanı Servisi
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {bidType === 'quote' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Teklif Tutarı (TL)</Text>
                <View style={styles.inputWrapper}>
                  <DollarSign size={20} color={COLORS.textLight} />
                  <TextInput
                    style={styles.input}
                    value={bidAmount}
                    onChangeText={setBidAmount}
                    placeholder="Örn: 5000"
                    keyboardType="numeric"
                  />
                </View>
              </View>



              <View style={styles.inputGroup}>
                <Text style={styles.label}>Planlanan Çalışma Tarihleri</Text>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Teklif Açıklaması</Text>
                <TextInput
                  style={styles.textArea}
                  value={bidDescription}
                  onChangeText={setBidDescription}
                  placeholder="İşin nasıl yapılacağını, hangi malzemelerin kullanılacağını açıklayın"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}

          {bidType === 'info_request' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hangi Bilgilere İhtiyacınız Var?</Text>
              <TextInput
                style={styles.textArea}
                value={bidDescription}
                onChangeText={setBidDescription}
                placeholder="Teklif verebilmek için ihtiyaç duyduğunuz ek bilgileri belirtin"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}

          {bidType === 'diagnostic_service' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sorun Tespiti Servis Ücreti (TL)</Text>
                <View style={styles.inputWrapper}>
                  <DollarSign size={20} color={COLORS.textLight} />
                  <TextInput
                    style={styles.input}
                    value={bidAmount}
                    onChangeText={setBidAmount}
                    placeholder="Örn: 1500"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sorun Tespiti Notları</Text>
                <TextInput
                  style={styles.textArea}
                  value={bidDescription}
                  onChangeText={setBidDescription}
                  placeholder="Sorun tespiti için yapılacak işlemleri ve süreçleri açıklayın"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={submitBid}
            disabled={submitting}
            activeOpacity={submitting ? 1 : 0.7}
          >
            {submitting ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={styles.submitBtnText}>Gönderiliyor...</Text>
              </>
            ) : (
              <>
                <Send size={20} color="white" />
                <Text style={styles.submitBtnText}>
                  {bidType === 'quote'
                    ? 'Teklif Gönder'
                    : bidType === 'info_request'
                      ? 'Bilgi Talebi Gönder'
                      : 'Sorun Tespiti Gönder'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView >
    </SafeAreaView >
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
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
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
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  authText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  requestDesc: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.secondary,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
    flex: 1,
  },
  roundBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roundBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  roundInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  roundInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  bidTypeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  bidTypeBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  bidTypeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  iconCircleBlue: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  iconCircleOrange: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  iconCircleIndigo: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  bidTypeBtnActiveBlue: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  bidTypeBtnActiveOrange: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  bidTypeBtnActiveIndigo: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  bidTypeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  bidTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    textAlign: 'center',
  },
  bidTypeBtnTextBlue: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  bidTypeBtnTextOrange: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  bidTypeBtnTextIndigo: {
    color: '#6366f1',
    fontWeight: '700',
  },
  bidTypeBtnTextActive: {
    color: 'white',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: COLORS.secondary,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontSize: 15,
    color: COLORS.secondary,
    minHeight: 100,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  bidStatsBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    gap: 12,
  },
  bidStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bidStatLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  bidStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 'auto',
  },
});
