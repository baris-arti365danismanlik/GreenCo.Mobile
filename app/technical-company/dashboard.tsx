import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Building2,
  Award,
  LogOut,
  Stethoscope,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';

type Stats = {
  available_requests: number;
  my_bids: number;
  active_jobs: number;
  completed_jobs: number;
  diagnostic_jobs: number;
};

type CompanyInfo = {
  company_name: string;
  average_rating: number;
  total_jobs: number;
};
// ... (rest of types)

export default function TechnicalCompanyDashboard() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    available_requests: 0,
    my_bids: 0,
    active_jobs: 0,
    completed_jobs: 0,
    diagnostic_jobs: 0,
  });
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      const technicalCompanyId = (profile as any)?.technical_company_id;

      if (!technicalCompanyId) {
        console.error('No technical company ID found');
        setLoading(false);
        return;
      }

      const { data: companyData, error: companyError } = await supabase
        .from('technical_service_companies')
        .select('company_name, average_rating, total_jobs')
        .eq('id', technicalCompanyId)
        .maybeSingle();

      if (companyError) {
        console.error('Error loading company:', companyError);
      }

      if (companyData) {
        // Calculate stats dynamically from assignments to ensure accuracy
        const { data: assignmentStats } = await supabase
          .from('technical_service_assignments')
          .select('pm_rating')
          .eq('company_id', technicalCompanyId)
          .not('pm_rating', 'is', null);

        let dynamicAvg = 0;
        let dynamicCount = 0;

        if (assignmentStats && assignmentStats.length > 0) {
          dynamicCount = assignmentStats.length;
          const sum = assignmentStats.reduce((acc, curr) => acc + (Number(curr.pm_rating) || 0), 0);
          dynamicAvg = sum / dynamicCount;
        }

        setCompanyInfo({
          ...companyData,
          average_rating: dynamicAvg,
          total_jobs: dynamicCount
        });
      }

      // Get company info for filtering
      const { data: company } = await supabase
        .from('technical_service_companies')
        .select('location_city, location_district')
        .eq('id', technicalCompanyId)
        .maybeSingle();

      // Get company specialties
      const { data: companySpecialties } = await supabase
        .from('technical_service_company_specialties')
        .select('service_type_id')
        .eq('company_id', technicalCompanyId);

      const specialtyIds = new Set(companySpecialties?.map(s => s.service_type_id) || []);

      // Get company authorized brands
      const { data: authorizedBrands } = await supabase
        .from('company_authorized_brands')
        .select('brand_id')
        .eq('company_id', technicalCompanyId);

      const authorizedBrandIds = new Set(authorizedBrands?.map(b => b.brand_id) || []);

      // Get all bidding requests
      const { data: allBiddingRequests } = await supabase
        .from('technical_service_requests')
        .select('id, location_city, location_district, service_type_id, brand_id, send_to_authorized_service, status, updated_at')
        .in('status', ['bidding', 'revision_requested', 'info_needed']);

      // Get request IDs where this company already has a bid, with their creation dates and status
      const { data: existingBids } = await supabase
        .from('technical_service_bids')
        .select('request_id, created_at, status')
        .eq('company_id', technicalCompanyId);

      const bidsInfoByRequest = new Map<string, Array<{ created_at: string, status: string }>>();
      existingBids?.forEach(bid => {
        const infos = bidsInfoByRequest.get(bid.request_id) || [];
        infos.push({ created_at: bid.created_at, status: bid.status });
        bidsInfoByRequest.set(bid.request_id, infos);
      });

      // Count companies per district+service_type for geographic filtering logic
      const districtCompanyCounts: Map<string, number> = new Map();
      const debugInfo: any[] = [];

      for (const req of allBiddingRequests || []) {
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

      console.log('🔍 DASHBOARD COMPANY COUNT:', JSON.stringify(debugInfo, null, 2));

      // Apply filtering criteria
      const availableCount = (allBiddingRequests || []).filter((req) => {
        const decision: any = {
          req_id: req.id,
          req_district: req.location_district,
          my_district: company?.location_district,
          passed: true,
          reason: []
        };

        const myBids = bidsInfoByRequest.get(req.id);
        const hasBid = !!myBids && myBids.length > 0;

        // Check if previously bid
        if (hasBid) {
          if (req.status === 'revision_requested') {
            // Validating if we have responded to the revision
            const requestUpdateTime = new Date(req.updated_at).getTime();
            const hasNewResponse = myBids.some(b => new Date(b.created_at).getTime() > requestUpdateTime);

            if (hasNewResponse) {
              decision.passed = false;
              decision.reason.push('Already responded to revision');
              return false;
            }
          } else if (req.status === 'info_needed') {
            // Only show if I have an ACCEPTED bid (meaning I am the one requested for info)
            const hasAcceptedBid = myBids.some(b => b.status === 'accepted');

            if (!hasAcceptedBid) {
              // I am not the selected company
              decision.passed = false;
              decision.reason.push('Not selected for info');
              return false;
            }

            // If I am selected, checking if I have responded with a NEW bid (post info request)
            const requestUpdateTime = new Date(req.updated_at).getTime();
            // Look for a bid created AFTER update time (which isn't the accepted one ideally, but any new bid works)
            const hasNewResponse = myBids.some(b =>
              new Date(b.created_at).getTime() > requestUpdateTime
            );

            if (hasNewResponse) {
              decision.passed = false;
              decision.reason.push('Already responded to info request');
              return false;
            }
            // Show it!
          } else {
            // Normal bidding status - if bid exists, hide it (unless rejected? if rejected maybe show again? No, usually not.)
            decision.passed = false;
            decision.reason.push('Already bid');
            return false;
          }
        }

        // 1. Service specialty matching (must match first)
        if (!specialtyIds.has(req.service_type_id)) {
          decision.passed = false;
          decision.reason.push('No specialty');
          console.log('❌ DASHBOARD:', decision);
          return false;
        }

        // 2. Authorized brands - only if request requires authorized service
        if (req.send_to_authorized_service && req.brand_id) {
          if (!authorizedBrandIds.has(req.brand_id)) {
            decision.passed = false;
            decision.reason.push('Not authorized brand');
            console.log('❌ DASHBOARD:', decision);
            return false;
          }
        }

        // 3. Geographic filtering with dynamic district filter
        if (company) {
          // City must always match
          if (req.location_city !== company.location_city) {
            decision.passed = false;
            decision.reason.push(`City: ${req.location_city} vs ${company.location_city}`);
            console.log('❌ DASHBOARD:', decision);
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
              console.log('❌ DASHBOARD:', decision);
              return false;
            }
          } else {
            decision.reason.push(`Only ${companiesInDistrict} in district → no strict`);
          }
        }

        console.log('✅ DASHBOARD:', decision);
        return true;
      }).length;

      const { count: myBidsCount } = await supabase
        .from('technical_service_bids')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', technicalCompanyId)
        .eq('status', 'pending');

      const { count: activeJobsCount } = await supabase
        .from('technical_service_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', technicalCompanyId)
        .is('completion_date', null);

      const { count: completedJobsCount } = await supabase
        .from('technical_service_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', technicalCompanyId)
        .not('completion_date', 'is', null);


      // Get diagnostic jobs count
      const { data: diagnosticJobsReqs } = await supabase
        .from('technical_service_requests')
        .select('id, selected_bid_id')
        .eq('status', 'diagnostic_in_progress');

      let diagnosticCount = 0;
      if (diagnosticJobsReqs && diagnosticJobsReqs.length > 0) {
        const bidIds = diagnosticJobsReqs.map(r => r.selected_bid_id);
        const { data: myBids } = await supabase
          .from('technical_service_bids')
          .select('id')
          .in('id', bidIds)
          .eq('company_id', technicalCompanyId);

        diagnosticCount = myBids?.length || 0;
      }

      setStats({
        available_requests: availableCount,
        my_bids: existingBids?.filter(b => b.status === 'pending').length || 0,
        active_jobs: activeJobsCount || 0,
        completed_jobs: completedJobsCount || 0,
        diagnostic_jobs: diagnosticCount,
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push('/(auth)/role-select')}
        >
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Teknisyen Firma</Text>
          <Text style={styles.headerSub}>
            {companyInfo?.company_name || 'Dashboard'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
        >
          <LogOut size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {companyInfo && (
              <View style={styles.companyCard}>
                <View style={styles.companyHeader}>
                  <View style={styles.companyIconBox}>
                    <Building2 size={28} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.companyName}>{companyInfo.company_name}</Text>
                    <View style={styles.companyMeta}>
                      <View style={styles.ratingBox}>
                        <Award size={16} color="#f59e0b" />
                        <Text style={styles.ratingText}>
                          {(companyInfo.average_rating || 0).toFixed(1)}
                        </Text>
                      </View>
                      <Text style={styles.jobsText}>
                        {companyInfo.total_jobs || 0} İş Tamamlandı
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.statsGrid}>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: '#dbeafe' }]}
                onPress={() => router.push('/technical-company/available-requests')}
              >
                <View style={[styles.iconBox, { backgroundColor: '#3b82f6' }]}>
                  <FileText size={24} color="white" />
                </View>
                <Text style={styles.statNumber}>{stats.available_requests}</Text>
                <Text style={styles.statLabel}>Teklif Verilebilir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: '#fef3c7' }]}
                onPress={() => router.push('/technical-company/bids')}
              >
                <View style={[styles.iconBox, { backgroundColor: '#f59e0b' }]}>
                  <Clock size={24} color="white" />
                </View>
                <Text style={styles.statNumber}>{stats.my_bids}</Text>
                <Text style={styles.statLabel}>Bekleyen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: '#e0f2fe' }]}
                onPress={() => router.push('/technical-company/active-jobs')}
              >
                <View style={[styles.iconBox, { backgroundColor: '#0ea5e9' }]}>
                  <AlertCircle size={24} color="white" />
                </View>
                <Text style={styles.statNumber}>{stats.active_jobs}</Text>
                <Text style={styles.statLabel}>Aktif İşler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: '#d1fae5' }]}
                onPress={() => router.push({ pathname: '/technical-company/active-jobs', params: { view: 'completed' } })}
              >
                <View style={[styles.iconBox, { backgroundColor: '#10b981' }]}>
                  <CheckCircle size={24} color="white" />
                </View>
                <Text style={styles.statNumber}>{stats.completed_jobs}</Text>
                <Text style={styles.statLabel}>Tamamlanan</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hızlı Erişim</Text>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/technical-company/available-requests')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
                  <FileText size={24} color="#3b82f6" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Teklif Verilebilir Talepler</Text>
                  <Text style={styles.actionDesc}>
                    Yeni servis taleplerini görüntüle ve teklif ver
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/technical-company/bids')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                  <DollarSign size={24} color="#f59e0b" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Tekliflerim</Text>
                  <Text style={styles.actionDesc}>
                    Verdiğiniz teklifleri görüntüle ve yönet
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/technical-company/diagnostic-jobs')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#e0e7ff' }]}>
                  <Stethoscope size={24} color="#6366f1" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Tanı İşleri</Text>
                  <Text style={styles.actionDesc}>
                    Onaylanan tanı servisi işlerini görüntüle ve rapor yaz
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/technical-company/active-jobs')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#e0f2fe' }]}>
                  <AlertCircle size={24} color="#0284c7" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Aktif İşlerim</Text>
                  <Text style={styles.actionDesc}>
                    Devam eden işlerinizi takip edin
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/technical-company/profile')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#e0e7ff' }]}>
                  <Building2 size={24} color="#6366f1" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Firma Profilim</Text>
                  <Text style={styles.actionDesc}>
                    Firma bilgilerinizi görüntüle
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
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
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  content: {
    flex: 1,
  },
  companyCard: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  companyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  jobsText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 14,
    color: COLORS.textLight,
  },
});
