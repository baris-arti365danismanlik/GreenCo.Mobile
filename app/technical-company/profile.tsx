import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Award,
  Briefcase,
  CreditCard,
  Star,
  LogOut,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CompanyInfo = {
  company_name: string;
  tax_number: string;
  phone: string;
  email: string;
  location_city: string;
  location_district: string;
  bank_name: string | null;
  bank_account_holder: string | null;
  iban: string | null;
  average_rating: number;
  total_jobs: number;
  is_active: boolean;
};

type Specialty = {
  technical_service_types: {
    name: string;
  };
};

export default function TechnicalCompanyProfile() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  useEffect(() => {
    loadCompanyProfile();
  }, []);

  const loadCompanyProfile = async () => {
    try {
      console.log('Loading company profile, full profile:', profile);
      let technicalCompanyId = (profile as any)?.technical_company_id;
      console.log('Technical company ID from profile:', technicalCompanyId);

      if (!technicalCompanyId) {
        const { data: { user } } = await supabase.auth.getUser();
        technicalCompanyId = user?.app_metadata?.technical_company_id;
        console.log('Technical company ID from JWT:', technicalCompanyId);
      }

      if (!technicalCompanyId) {
        console.error('No technical_company_id found in profile or JWT');
        setLoading(false);
        return;
      }

      const { data: company, error: companyError } = await supabase
        .from('technical_service_companies')
        .select('*')
        .eq('id', technicalCompanyId)
        .maybeSingle();

      if (companyError) {
        console.error('Error loading company:', companyError);
      }

      const { data: specs } = await supabase
        .from('technical_service_company_specialties')
        .select(`
          technical_service_types(name)
        `)
        .eq('company_id', technicalCompanyId);

      if (company) setCompanyInfo(company);
      if (specs) setSpecialties(specs);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!companyInfo) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyState}>
          <Building2 size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Firma Bilgisi Bulunamadı</Text>
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
          <Text style={styles.headerTitle}>Firma Profilim</Text>
          <Text style={styles.headerSub}>Firma bilgileri</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.companyHeader}>
          <View style={styles.companyIconBox}>
            <Building2 size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.companyName}>{companyInfo.company_name}</Text>
          <View style={styles.ratingBox}>
            <Star size={20} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.ratingText}>
              {(companyInfo.average_rating || 0).toFixed(1)}
            </Text>
          </View>
          <Text style={styles.jobsText}>{companyInfo.total_jobs || 0} İş Tamamlandı</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>İletişim Bilgileri</Text>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Phone size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Telefon</Text>
              <Text style={styles.infoValue}>{companyInfo.phone}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Mail size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>E-posta</Text>
              <Text style={styles.infoValue}>{companyInfo.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <MapPin size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Konum</Text>
              <Text style={styles.infoValue}>
                {companyInfo.location_district}, {companyInfo.location_city}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Firma Bilgileri</Text>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Briefcase size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Vergi Numarası</Text>
              <Text style={styles.infoValue}>{companyInfo.tax_number}</Text>
            </View>
          </View>
        </View>

        {(companyInfo.bank_name || companyInfo.iban) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Banka Bilgileri</Text>

            {companyInfo.bank_name && (
              <View style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <CreditCard size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Banka</Text>
                  <Text style={styles.infoValue}>{companyInfo.bank_name}</Text>
                </View>
              </View>
            )}

            {companyInfo.bank_account_holder && (
              <View style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <Building2 size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Hesap Sahibi</Text>
                  <Text style={styles.infoValue}>{companyInfo.bank_account_holder}</Text>
                </View>
              </View>
            )}

            {companyInfo.iban && (
              <View style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <CreditCard size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>IBAN</Text>
                  <Text style={styles.infoValue}>{companyInfo.iban}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {specialties.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Uzmanlık Alanları</Text>
            <View style={styles.specialtiesGrid}>
              {specialties.map((spec, index) => (
                <View key={index} style={styles.specialtyBadge}>
                  <Award size={16} color={COLORS.primary} />
                  <Text style={styles.specialtyText}>
                    {spec.technical_service_types.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.statusBox}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: companyInfo.is_active ? '#10b981' : '#dc2626' },
              ]}
            />
            <Text style={styles.statusText}>
              {companyInfo.is_active ? 'Aktif Firma' : 'Pasif Firma'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
        >
          <LogOut size={20} color={COLORS.error} />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
  companyHeader: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  companyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  companyName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
  },
  jobsText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.secondary,
    lineHeight: 20,
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  specialtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
});
