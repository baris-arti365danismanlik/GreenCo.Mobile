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
import { ArrowLeft, Building2, MapPin, FileText, CheckCircle, Calendar, Users, DollarSign, MessageSquare, Stethoscope, Send, AlertCircle, Clock, XCircle, RefreshCcw, Edit, Save, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';

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
    commission_rate: number;
  } | null;
  technical_service_types?: {
    name: string;
  } | null;
  projects_greenco?: {
    name: string;
  } | null;
  diagnostic_report?: string | null;
};

export default function AdminTechnicalRequestDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [descriptionText, setDescriptionText] = useState('');
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
      const { data, error } = await supabase
        .from('technical_service_requests')
        .select(`
          *,
          companies(name, commission_rate),
          technical_service_types(name),
          projects_greenco(name),
          diagnostic_report
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setRequest(data);
      if (data?.description) setDescriptionText(data.description);

      if (data && data.status !== 'pending_review') {
        const { data: bidsData } = await supabase
          .from('technical_service_bids')
          .select('*, technical_service_companies(company_name)')
          .eq('request_id', id);

        if (bidsData) {
          setBids(bidsData);
        }

        if (bidsData && bidsData.length > 0) {
          // Filter out rejected/archived bids for statistics
          const activeBids = bidsData.filter(b => b.status !== 'rejected');

          const priceQuotes = activeBids.filter(b => b.bid_type === 'quote');
          const infoRequests = activeBids.filter(b => b.bid_type === 'info_request');
          const diagnosticServices = activeBids.filter(b => b.bid_type === 'diagnostic_service');

          // En düşük fiyatı hesapla (Komisyon dahil en uygun teklifi bul)
          let bestBid: { raw: number; final: number } | undefined;

          if (priceQuotes.length > 0) {
            // @ts-ignore
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
      bidding: 'Teklif Toplanıyor',
      awaiting_customer_decision: 'Fiyat Teklifi Verildi',
      approved: 'Onaylandı',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'Reddedildi',
      revision_requested: 'Revizyon İsteniyor',
      pending: 'Bekliyor',
      accepted: 'Kabul Edildi',
      rejected: 'Reddedildi',
    };
    return labels[status] || status;
  };

  const handleStartBidding = async () => {
    const confirmed = window.confirm(
      'Teknik servislere bildirim gönderilecek. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'bidding',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      window.alert('Başarılı: Teklif toplama başlatıldı');
      await loadRequest();
    } catch (error) {
      console.error('Error starting bidding:', error);
      window.alert('Hata: İşlem başarısız');
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestRevision = async () => {
    const confirmed = window.confirm(
      'Bu talep için revizyon istenecek. Firmalara bildirim gönderilecek. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) return;

    try {
      setUpdating(true);

      let newDescription = request.description;
      if (request.diagnostic_report) {
        newDescription += `\n\n--- TANI RAPORU VE İSTENEN PARÇALAR ---\n${request.diagnostic_report}`;
      }

      const { data, error } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'revision_requested',
          description: newDescription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

      if (error) throw error;

      window.alert('Revizyon talebi iletildi');
      await loadRequest();
    } catch (error) {
      console.error('Error requesting revision:', error);
      window.alert('Hata: İşlem başarısız - ' + (error as any).message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    const confirmed = window.confirm(
      'Bu talep reddedilecek. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      window.alert('Başarılı: Talep reddedildi');
      await loadRequest();
    } catch (error) {
      console.error('Error rejecting request:', error);
      window.alert('Hata: İşlem başarısız');
    } finally {
      setUpdating(false);
    }
  };

  const handleFinalizeBidding = async () => {
    const confirmed = window.confirm(
      'Teklif toplama süreci sonlandırılıp operasyon onayına sunulacak. Yalnızca firmaların son revize teklifleri aktif olacak, diğerleri arşivlenecek. Devam etmek istiyor musunuz?'
    );
    if (!confirmed) return;

    try {
      setUpdating(true);

      // 1. Get all bids for this request
      const { data: currentBids, error: bidsError } = await supabase
        .from('technical_service_bids')
        .select('id, company_id, created_at')
        .eq('request_id', id);

      if (bidsError) throw bidsError;

      if (currentBids && currentBids.length > 0) {
        // 2. Group by company
        const bidsByCompany: Record<string, typeof currentBids> = {};
        currentBids.forEach(bid => {
          if (!bidsByCompany[bid.company_id]) {
            bidsByCompany[bid.company_id] = [];
          }
          bidsByCompany[bid.company_id].push(bid);
        });

        // 3. Determine which to archive
        const idsToArchive: string[] = [];
        const idsToKeep: string[] = [];

        Object.values(bidsByCompany).forEach(companyBids => {
          // Sort by date descending (newest first)
          companyBids.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          // Keep the first one (newest), archive the rest
          if (companyBids.length > 0) {
            idsToKeep.push(companyBids[0].id);
            // Add others to archive list
            for (let i = 1; i < companyBids.length; i++) {
              idsToArchive.push(companyBids[i].id);
            }
          }
        });

        // 4. Update statuses
        // Archive old bids (mark as rejected since archived enum doesn't exist)
        if (idsToArchive.length > 0) {
          const { error: archiveError } = await supabase
            .from('technical_service_bids')
            .update({ status: 'rejected' })
            .in('id', idsToArchive);

          if (archiveError) throw archiveError;
        }

        // Ensure latest bids are pending (if they were something else, though usually they are pending)
        if (idsToKeep.length > 0) {
          const { error: keepError } = await supabase
            .from('technical_service_bids')
            .update({ status: 'pending' })
            .in('id', idsToKeep);

          if (keepError) throw keepError;
        }
      }

      // 5. Update request status
      const { error } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'awaiting_customer_decision',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      window.alert('Başarılı: Talep operasyon onayına sunuldu ve eski teklifler arşivlendi.');
      loadRequest();
    } catch (error) {
      console.error('Error finalizing bidding:', error);
      window.alert('Hata: İşlem başarısız');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveDescription = async () => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('technical_service_requests')
        .update({
          description: descriptionText,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      Alert.alert('Başarılı', 'Açıklama güncellendi.');
      setEditMode(false);
      setRequest(prev => prev ? ({ ...prev, description: descriptionText }) : null);

    } catch (e) {
      Alert.alert('Hata', 'Güncelleme başarısız');
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const handleSolicitBidsWithDiagnostic = async () => {
    const confirmed = window.confirm(
      'Tanı raporu ile teklif toplama başlatılacak. Mevcut teklifler revizyona çekilecek ve yeni firmalar da teklif verebilecek. Devam etmek istiyor musunuz?'
    );

    if (!confirmed) return;

    try {
      setUpdating(true);

      // 1. Prepare description
      let newDescription = request.description;
      // Only append if not already appended (simple check)
      if (request.diagnostic_report && !newDescription.includes('--- TANI RAPORU')) {
        newDescription += `\n\n--- TANI RAPORU VE İSTENEN PARÇALAR ---\n${request.diagnostic_report}`;
      }

      // 2. Update existing bids to 'revision_requested' so they can bid again
      const { error: bidsError } = await supabase
        .from('technical_service_bids')
        .update({ status: 'revision_requested' })
        .eq('request_id', id);

      if (bidsError) console.warn('Error updating bids:', bidsError);

      // 3. Update Request to 'bidding' (so it appears as new for everyone)
      const { error } = await supabase
        .from('technical_service_requests')
        .update({
          status: 'bidding',
          description: newDescription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      window.alert('Başarılı: Tanı raporu ile teklif süreci başlatıldı.');
      await loadRequest();
    } catch (error) {
      console.error('Error initiating diagnostic bidding:', error);
      window.alert('Hata: İşlem başarısız');
    } finally {
      setUpdating(false);
    }
  };

  const hasDiagnosticReport = !!(request?.diagnostic_report);


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
              <Text style={styles.infoValue}>
                {request.companies?.name || '-'}
              </Text>
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

          {request.diagnostic_report && (
            <View style={[styles.section, { backgroundColor: '#e0e7ff', padding: 12, borderRadius: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Stethoscope size={20} color="#4338ca" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#4338ca' }}>Tanı Raporu</Text>
              </View>
              <Text style={{ fontSize: 15, color: '#3730a3', lineHeight: 22 }}>
                {request.diagnostic_report}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Açıklama</Text>
              {request.status === 'info_needed' && !editMode && (
                <TouchableOpacity
                  onPress={() => setEditMode(true)}
                  style={{ padding: 4 }}
                >
                  <Edit size={18} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {editMode ? (
              <View>
                <TextInput
                  multiline
                  value={descriptionText}
                  onChangeText={setDescriptionText}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 8,
                    padding: 12,
                    minHeight: 100,
                    textAlignVertical: 'top',
                    fontSize: 15,
                    color: COLORS.text,
                    backgroundColor: '#fff'
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditMode(false);
                      setDescriptionText(request.description);
                    }}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      backgroundColor: '#f3f4f6',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <X size={16} color={COLORS.text} />
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveDescription}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      backgroundColor: COLORS.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Save size={16} color="#fff" />
                    )}
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Kaydet</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.description}>{request.description}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Durum</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
            </View>
          </View>

          {request.status === 'bidding' && bidStats && bidStats.count > 0 && (
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

          {/* Display Accepted Bid Details (Winner Card) */}
          {['approved', 'in_progress', 'completed'].includes(request.status) && bids.find((b: any) => b.status === 'accepted') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Onaylanan Teklif</Text>
              {(() => {
                const acceptedBid = bids.find((b: any) => b.status === 'accepted');
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
                          <Clock size={16} color={COLORS.textLight} />
                          <Text style={{ color: COLORS.textLight }}>Çalışma Takvimi:</Text>
                          {acceptedBid.estimated_duration.includes('/') ? (
                            <View>
                              <Text style={{ fontSize: 15, color: COLORS.secondary, fontWeight: '500' }}>
                                Başlangıç: {new Date(acceptedBid.estimated_duration.split('/')[0]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </Text>
                              <Text style={{ fontSize: 15, color: COLORS.secondary, fontWeight: '500' }}>
                                Bitiş: {new Date(acceptedBid.estimated_duration.split('/')[1]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 15, color: COLORS.secondary, fontWeight: '500' }}>{acceptedBid.estimated_duration}</Text>
                          )}
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

          {/* Display Grouped Bids for Admin */}
          {bids.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gelen Teklifler ({bids.length})</Text>
              {(() => {
                // Group bids by company
                const groupedBids: Record<string, any[]> = {};
                bids.forEach(bid => {
                  const companyName = bid.technical_service_companies?.company_name || 'Bilinmeyen Firma';
                  if (!groupedBids[companyName]) {
                    groupedBids[companyName] = [];
                  }
                  groupedBids[companyName].push(bid);
                });

                // Render each company group
                return Object.entries(groupedBids).map(([companyName, companyBids]) => {
                  // Sort bids by creation date (oldest first)
                  companyBids.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                  return (
                    <View key={companyName} style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.secondary, marginBottom: 8 }}>
                        {companyName}
                      </Text>
                      {companyBids.map((bid, index) => (
                        <View key={bid.id} style={[styles.card, { marginLeft: 12, borderLeftWidth: 4, borderLeftColor: index === 0 ? COLORS.textLight : COLORS.primary }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                              <Text style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: COLORS.primary,
                                backgroundColor: COLORS.primary + '15',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 4
                              }}>
                                {index === 0 ? 'İlk Teklif' : `Revizyon ${index}`}
                              </Text>
                              {index === companyBids.length - 1 && (
                                <Text style={{ fontSize: 11, color: COLORS.success, fontWeight: '700' }}>(Son)</Text>
                              )}
                            </View>

                            <View style={[
                              styles.statusBadge,
                              { backgroundColor: bid.status === 'accepted' ? '#dcfce7' : '#f3f4f6' }
                            ]}>
                              <Text style={{
                                color: bid.status === 'accepted' ? '#166534' : '#6b7280',
                                fontSize: 12,
                                fontWeight: '600'
                              }}>
                                {getStatusLabel(bid.status)}
                              </Text>
                            </View>
                          </View>

                          <View style={{ marginBottom: 8 }}>
                            <Text style={{ fontSize: 13, color: COLORS.textLight }}>
                              {bid.description}
                            </Text>
                            {bid.estimated_duration && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                <Clock size={14} color={COLORS.textLight} />
                                {bid.estimated_duration.includes('/') ? (
                                  <Text style={{ fontSize: 13, color: COLORS.secondary }}>
                                    {new Date(bid.estimated_duration.split('/')[0]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - {new Date(bid.estimated_duration.split('/')[1]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </Text>
                                ) : (
                                  <Text style={{ fontSize: 13, color: COLORS.secondary }}>
                                    Süre: {bid.estimated_duration}
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                            <View>
                              <Text style={{ color: COLORS.textLight, fontSize: 12, marginBottom: 2 }}>Ham Tutar (Net):</Text>
                              <Text style={{ fontWeight: '600', color: COLORS.secondary, fontSize: 15 }}>
                                {bid.bid_amount ? new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: 'TRY',
                                  minimumFractionDigits: 0,
                                }).format(bid.bid_amount) : '-'}
                              </Text>
                            </View>
                            <View style={{ width: 1, backgroundColor: COLORS.border }} />
                            <View>
                              <Text style={{ color: COLORS.textLight, fontSize: 12, marginBottom: 2 }}>Müşteri Fiyatı (+Koms):</Text>
                              <Text style={{ fontWeight: '700', color: COLORS.primary, fontSize: 16 }}>
                                {bid.bid_amount ? new Intl.NumberFormat('tr-TR', {
                                  style: 'currency',
                                  currency: 'TRY',
                                  minimumFractionDigits: 0,
                                }).format(bid.bid_amount * (1 + (request.companies?.commission_rate || 0))) : '-'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                });
              })()}
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

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryBtn, (!bidStats || bidStats.count === 0) && styles.disabledBtn]}
                onPress={handleRequestRevision}
                disabled={updating || !bidStats || bidStats.count === 0}
              >
                <RefreshCcw size={20} color={COLORS.primary} />
                <Text style={styles.secondaryBtnText}>Revize Et</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#ef4444' }]}
                onPress={handleReject}
                disabled={updating}
              >
                <XCircle size={20} color="#ef4444" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#ef4444' }}>Reddet</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {['bidding', 'revision_requested', 'info_needed'].includes(request.status) && bidStats && bidStats.count > 0 && (
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

            {hasDiagnosticReport && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryBtn, { borderColor: '#6366f1' }]}
                onPress={handleSolicitBidsWithDiagnostic}
                disabled={updating}
              >
                <Stethoscope size={20} color="#6366f1" />
                <Text style={[styles.secondaryBtnText, { color: '#6366f1' }]}>Tanı Raporu ile Teklif Al</Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryBtn]}
                onPress={handleRequestRevision}
                disabled={updating}
              >
                <RefreshCcw size={20} color={COLORS.primary} />
                <Text style={styles.secondaryBtnText}>Revize Et</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#ef4444' }]}
                onPress={handleReject}
                disabled={updating}
              >
                <XCircle size={20} color="#ef4444" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#ef4444' }}>Reddet</Text>
              </TouchableOpacity>
            </View>
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
    borderWidth: 1,
    borderColor: COLORS.primary,
    flex: 1,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  disabledBtn: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    opacity: 0.5,
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
  // We don't have secondaryBtn style in the original file, it seems?
  // Checked lines 1-800. Yes, line 539 uses styles.secondaryBtn.
  // Wait, I see styles.secondaryBtn in Step 2172 line 539 ??
  // Let me check the styles definition in Step 2172.
  // It stops at line 800. The file has 803 lines?
  // Let me assume secondaryBtn was there or I need to add it.
  // I added it in my write_to_file content above.
});
