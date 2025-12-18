import { useState, useCallback } from 'react';
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
  MapPin,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Users,
  DollarSign,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ServiceRequest = {
  id: string;
  title: string;
  description: string;
  location_city: string;
  location_district: string;
  location_address: string;
  created_at: string;
  technical_service_types: {
    name: string;
  };
  asset_brands?: {
    name: string;
  } | null;
  asset_models?: {
    name: string;
  } | null;
  send_to_authorized_service: boolean;
  bid_count?: number;
  min_bid_amount?: number;
};

type CompanySpecialty = {
  service_type: string;
};

export default function AvailableRequests() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [specialties, setSpecialties] = useState<CompanySpecialty[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadCompanyInfo();
      loadRequests();
    }, [])
  );

  const loadCompanyInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('technical_company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.technical_company_id) return;

      const { data: specs } = await supabase
        .from('technical_service_company_specialties')
        .select(`
          service_type_id,
          technical_service_types(name)
        `)
        .eq('company_id', profile.technical_company_id);

      if (specs) {
        setSpecialties(
          specs.map((s: any) => ({
            service_type: s.technical_service_types?.name || '',
          }))
        );
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    }
  };

  const loadRequests = async () => {
    try {
      console.log('Loading available requests...');

      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('technical_company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.technical_company_id) return;

      // Get company info for filtering
      const { data: company } = await supabase
        .from('technical_service_companies')
        .select('location_city, location_district')
        .eq('id', profile.technical_company_id)
        .single();

      // Get company specialties
      const { data: companySpecialties } = await supabase
        .from('technical_service_company_specialties')
        .select('service_type_id')
        .eq('company_id', profile.technical_company_id);

      const specialtyIds = new Set(companySpecialties?.map(s => s.service_type_id) || []);

      // Get company authorized brands
      const { data: authorizedBrands } = await supabase
        .from('company_authorized_brands')
        .select('brand_id')
        .eq('company_id', profile.technical_company_id);

      const authorizedBrandIds = new Set(authorizedBrands?.map(b => b.brand_id) || []);

      // Get all bidding requests
      const { data: allRequests, error: requestsError } = await supabase
        .from('technical_service_requests')
        .select(`
          id,
          title,
          description,
          location_city,
          location_district,
          location_address,
          send_to_authorized_service,
          created_at,
          service_type_id,
          brand_id,
          model_id,
          technical_service_types!technical_service_requests_service_type_id_fkey(name),
          asset_brands!technical_service_requests_brand_id_fkey(name),
          asset_models!technical_service_requests_model_id_fkey(name)
        `)
        .eq('status', 'bidding')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Get request IDs where this company already has a bid
      const { data: existingBids, error: bidsError } = await supabase
        .from('technical_service_bids')
        .select('request_id')
        .eq('company_id', profile.technical_company_id);

      if (bidsError) throw bidsError;

      const biddedRequestIds = new Set(existingBids?.map(b => b.request_id) || []);

      // Count companies per district+service_type for geographic filtering logic
      const districtCompanyCounts: Map<string, number> = new Map();
      const debugInfo: any[] = [];

      for (const req of allRequests || []) {
        const key = `${req.location_district}_${req.service_type_id}`;
        if (!districtCompanyCounts.has(key)) {
          // First get all companies with this specialty
          const { data: specialtyCompanies, error: specialtyError } = await supabase
            .from('technical_service_company_specialties')
            .select('company_id')
            .eq('service_type_id', req.service_type_id);

          if (specialtyError) {
            console.error('❌ Specialty query error:', specialtyError);
          }

          const companyIdsWithSpecialty = specialtyCompanies?.map(s => s.company_id) || [];

          if (companyIdsWithSpecialty.length > 0) {
            // Get all companies with details
            const { data: allCompanies } = await supabase
              .from('technical_service_companies')
              .select('id, name, location_district')
              .eq('is_active', true)
              .in('id', companyIdsWithSpecialty);

            // Count how many are in the request's district
            const companiesInDistrict = allCompanies?.filter(c => c.location_district === req.location_district) || [];

            districtCompanyCounts.set(key, companiesInDistrict.length);

            debugInfo.push({
              request_district: req.location_district,
              service_type: req.service_type_id,
              total_companies: companyIdsWithSpecialty.length,
              in_district: companiesInDistrict.length,
              names_in_district: companiesInDistrict.map(c => c.name).join(', '),
              all_companies: allCompanies?.map(c => `${c.name} (${c.location_district})`).join(', ')
            });
          } else {
            districtCompanyCounts.set(key, 0);
            debugInfo.push({
              request_district: req.location_district,
              service_type: req.service_type_id,
              total_companies: 0,
              in_district: 0,
              message: 'No companies with this specialty'
            });
          }
        }
      }

      console.log('🔍 COMPANY COUNT DEBUG:', JSON.stringify(debugInfo, null, 2));

      // Apply filtering criteria
      const filteredRequests = (allRequests || []).filter((req) => {
        const decision: any = {
          req_id: req.id,
          req_district: req.location_district,
          my_district: company?.location_district,
          passed: true,
          reason: []
        };

        // Already bid on this request
        if (biddedRequestIds.has(req.id)) {
          decision.passed = false;
          decision.reason.push('Already bid');
          console.log('❌', decision);
          return false;
        }

        // 1. Service specialty matching (must match first)
        if (!specialtyIds.has(req.service_type_id)) {
          decision.passed = false;
          decision.reason.push('No specialty');
          console.log('❌', decision);
          return false;
        }

        // 2. Authorized brands - only if request requires authorized service
        if (req.send_to_authorized_service && req.brand_id) {
          if (!authorizedBrandIds.has(req.brand_id)) {
            decision.passed = false;
            decision.reason.push('Not authorized brand');
            console.log('❌', decision);
            return false;
          }
        }

        // 3. Geographic filtering with dynamic district filter
        if (company) {
          // City must always match
          if (req.location_city !== company.location_city) {
            decision.passed = false;
            decision.reason.push(`City: ${req.location_city} vs ${company.location_city}`);
            console.log('❌', decision);
            return false;
          }

          // District filtering: only apply if >= 3 companies in that district with this specialty
          const key = `${req.location_district}_${req.service_type_id}`;
          const companiesInDistrict = districtCompanyCounts.get(key) || 0;

          decision.companies_in_req_district = companiesInDistrict;

          // If 3+ companies exist in request's district with this specialty, apply strict district filter
          if (companiesInDistrict >= 3) {
            decision.reason.push(`${companiesInDistrict}+ in district → strict`);
            // Must be in the same district
            if (req.location_district !== company.location_district) {
              decision.passed = false;
              decision.reason.push(`District: ${req.location_district} vs ${company.location_district}`);
              console.log('❌', decision);
              return false;
            }
          } else {
            decision.reason.push(`Only ${companiesInDistrict} in district → no strict`);
          }
        }

        console.log('✅', decision);
        return true;
      });

      // Get bid statistics for each request
      const requestsWithBidInfo = await Promise.all(
        filteredRequests.map(async (req) => {
          const { data: bids } = await supabase
            .from('technical_service_bids')
            .select('bid_amount')
            .eq('request_id', req.id);

          const bidCount = bids?.length || 0;
          const minBidAmount = bids && bids.length > 0
            ? Math.min(...bids.map(b => b.bid_amount))
            : undefined;

          return {
            ...req,
            bid_count: bidCount,
            min_bid_amount: minBidAmount,
          };
        })
      );

      console.log('Total bidding requests:', allRequests?.length || 0);
      console.log('Already bid on:', biddedRequestIds.size);
      console.log('After geographic filter:', filteredRequests.length);
      console.log('Final available requests:', requestsWithBidInfo.length);

      setRequests(requestsWithBidInfo);
    } catch (error) {
      console.error('Error loading requests:', error);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Teklif Verilebilir Talepler</Text>
          <Text style={styles.headerSub}>
            {requests.length} talep mevcut
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Debug Info - Geçici */}
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Debug Bilgisi:</Text>
              <Text style={styles.debugText}>Bulunan Talep: {requests.length}</Text>
              <Text style={styles.debugText}>Uzmanlıklar: {specialties.map(s => s.service_type).join(', ')}</Text>
            </View>

            {requests.length === 0 ? (
              <View style={styles.emptyState}>
                <FileText size={48} color={COLORS.textLight} />
                <Text style={styles.emptyTitle}>Henüz Uygun Talep Yok</Text>
                <Text style={styles.emptyDesc}>
                  Firmanızın uzmanlaştığı alanlardaki yeni talepler burada görünecek
                </Text>

            {specialties.length > 0 && (
              <View style={styles.specialtiesInfo}>
                <Text style={styles.specialtiesTitle}>Uzmanlaştığınız Alanlar:</Text>
                <View style={styles.specialtiesList}>
                  {specialties.map((spec, index) => (
                    <View key={index} style={styles.specialtyBadge}>
                      <CheckCircle size={14} color={COLORS.primary} />
                      <Text style={styles.specialtyText}>{spec.service_type}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.specialtiesNote}>
                  Sadece bu kategorilerdeki talepler size gösterilir
                </Text>
              </View>
            )}
              </View>
            ) : (
              <View style={styles.requestsList}>
            {requests.map((request) => (
              <TouchableOpacity
                key={request.id}
                style={styles.requestCard}
                onPress={() =>
                  router.push({
                    pathname: '/technical-company/request-detail',
                    params: { id: request.id },
                  })
                }
              >
                <View style={styles.requestHeader}>
                  <View style={styles.serviceTypeBadge}>
                    <Text style={styles.serviceTypeText}>
                      {request.technical_service_types.name}
                    </Text>
                  </View>
                  {request.send_to_authorized_service && (
                    <View style={styles.authBadge}>
                      <AlertCircle size={14} color="#dc2626" />
                      <Text style={styles.authText}>Yetkili Servis</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.requestDesc} numberOfLines={2}>
                  {request.description}
                </Text>

                {request.asset_brands && (
                  <View style={styles.assetInfo}>
                    <Text style={styles.assetText}>
                      {`${request.asset_brands.name}${request.asset_models ? ` - ${request.asset_models.name}` : ''}`}
                    </Text>
                  </View>
                )}

                <View style={styles.requestMeta}>
                  <View style={styles.metaItem}>
                    <MapPin size={14} color={COLORS.textLight} />
                    <Text style={styles.metaText}>
                      {request.location_city}, {request.location_district}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color={COLORS.textLight} />
                    <Text style={styles.metaText}>
                      {formatDate(request.created_at)}
                    </Text>
                  </View>
                </View>

                {(request.bid_count !== undefined && request.bid_count > 0) && (
                  <View style={styles.bidInfo}>
                    <View style={styles.bidInfoItem}>
                      <Users size={14} color={COLORS.primary} />
                      <Text style={styles.bidInfoText}>
                        {request.bid_count} teklif
                      </Text>
                    </View>
                    {request.min_bid_amount && (
                      <View style={styles.bidInfoItem}>
                        <DollarSign size={14} color={COLORS.primary} />
                        <Text style={styles.bidInfoText}>
                          Min: {new Intl.NumberFormat('tr-TR', {
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
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  specialtiesInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    maxWidth: 400,
  },
  specialtiesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  specialtiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  specialtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  specialtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  specialtiesNote: {
    fontSize: 12,
    color: COLORS.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  requestsList: {
    padding: 16,
    gap: 12,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestHeader: {
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  requestDesc: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 12,
  },
  assetInfo: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  assetText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  bidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0f2fe',
    backgroundColor: '#f0f9ff',
    marginHorizontal: -16,
    marginBottom: -16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bidInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bidInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  debugInfo: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 13,
    color: '#92400e',
    marginBottom: 4,
  },
});
