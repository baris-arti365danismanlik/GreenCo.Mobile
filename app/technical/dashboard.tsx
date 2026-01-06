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
  Plus,
  FileText,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  Package,
  MapPin,
  DollarSign,
  FolderKanban,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Stats = {
  pending_review: number;
  bidding: number;
  in_progress: number;
  completed: number;
};

type ProblematicItem = {
  type: 'asset' | 'location';
  label: string;
  sublabel?: string;
  count: number;
};

export default function TechnicalDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    pending_review: 0,
    bidding: 0,
    in_progress: 0,
    completed: 0,
  });
  const [problematicItems, setProblematicItems] = useState<ProblematicItem[]>([]);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'project_manager') {
          router.replace('/manager/technical-requests');
          return;
        }
      }
      loadStats();
    };
    checkRole();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .single();

      let query = supabase
        .from('technical_service_requests')
        .select(`
          status,
          asset_code,
          room_area,
          floor,
          technical_service_types(name)
        `);

      if (profile?.role === 'operations' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data } = await query;

      if (data) {
        const newStats: Stats = {
          pending_review: 0,
          bidding: 0,
          in_progress: 0,
          completed: 0,
        };

        const assetServiceMap = new Map<string, { service_type: string; asset_code: string; count: number }>();
        const serviceLocationMap = new Map<string, { service_type: string; room_area: string; floor: string; count: number }>();

        data.forEach((req: any) => {
          if (req.status === 'pending_review') newStats.pending_review++;
          else if (req.status === 'bidding') newStats.bidding++;
          else if (req.status === 'in_progress') newStats.in_progress++;
          else if (req.status === 'completed') newStats.completed++;

          if (req.asset_code && req.technical_service_types?.name) {
            const key = `${req.technical_service_types.name}|${req.asset_code}`;
            const existing = assetServiceMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              assetServiceMap.set(key, {
                service_type: req.technical_service_types.name,
                asset_code: req.asset_code,
                count: 1,
              });
            }
          }

          if (req.room_area && req.technical_service_types?.name) {
            const key = `${req.technical_service_types.name}|${req.room_area}|${req.floor || ''}`;
            const existing = serviceLocationMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              serviceLocationMap.set(key, {
                service_type: req.technical_service_types.name,
                room_area: req.room_area,
                floor: req.floor || '-',
                count: 1,
              });
            }
          }
        });

        setStats(newStats);

        const allItems: ProblematicItem[] = [];

        assetServiceMap.forEach((item) => {
          allItems.push({
            type: 'asset',
            label: item.service_type,
            sublabel: `Varlık Kodu: ${item.asset_code}`,
            count: item.count,
          });
        });

        serviceLocationMap.forEach((loc) => {
          allItems.push({
            type: 'location',
            label: loc.service_type,
            sublabel: `${loc.room_area} - Kat: ${loc.floor}`,
            count: loc.count,
          });
        });

        const sortedItems = allItems
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        setProblematicItems(sortedItems);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push('/(tabs)')}
        >
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Teknik Hizmetler</Text>
          <Text style={styles.headerSub}>Teknik destek ve çözümler</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
                <AlertCircle size={28} color="#f59e0b" />
                <Text style={styles.statNumber}>{stats.pending_review}</Text>
                <Text style={styles.statLabel}>İnceleme Bekliyor</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
                <Clock size={28} color="#3b82f6" />
                <Text style={styles.statNumber}>{stats.bidding}</Text>
                <Text style={styles.statLabel}>Teklif Toplama</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
                <FileText size={28} color="#f59e0b" />
                <Text style={styles.statNumber}>{stats.in_progress}</Text>
                <Text style={styles.statLabel}>Devam Eden</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
                <CheckCircle size={28} color="#10b981" />
                <Text style={styles.statNumber}>{stats.completed}</Text>
                <Text style={styles.statLabel}>Tamamlanan</Text>
              </View>
            </View>

            {problematicItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sık Sorun Yaşanan Ekipman/Tesisatlar</Text>
                <View style={styles.topListCard}>
                  {problematicItems.map((item, index) => (
                    <View key={`${item.label}-${index}`} style={styles.topListItem}>
                      <View style={styles.topListLeft}>
                        <View style={[styles.rankBadge, index === 0 && styles.rankBadgeFirst]}>
                          <Text style={[styles.rankText, index === 0 && styles.rankTextFirst]}>
                            {index + 1}
                          </Text>
                        </View>
                        <View style={[styles.topListIcon, { backgroundColor: '#fee2e2' }]}>
                          {item.type === 'asset' ? (
                            <Package size={20} color="#dc2626" />
                          ) : (
                            <MapPin size={20} color="#dc2626" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.topListLabel}>{item.label}</Text>
                          {item.sublabel && (
                            <Text style={styles.topListSubLabel}>{item.sublabel}</Text>
                          )}
                        </View>
                      </View>
                      <View style={[styles.topListBadge, { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.topListCount, { color: '#dc2626' }]}>{item.count}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hızlı Erişim</Text>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/operations/create-request?isNewProject=true&source=technical')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
                  <Plus size={24} color={COLORS.primary} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Yeni Proje Oluştur</Text>
                  <Text style={styles.actionDesc}>Yeni proje oluştur ve personel talep et</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/admin/project-requests')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#f3e8ff' }]}>
                  <FolderKanban size={24} color={COLORS.purple} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Proje Talepleri</Text>
                  <Text style={styles.actionDesc}>Teknik proje taleplerini yönet</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/technical/create-request')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#e0f2fe' }]}>
                  <Plus size={24} color="#0284c7" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Yeni Talep Oluştur</Text>
                  <Text style={styles.actionDesc}>Teknik destek talebi oluştur</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/technical/requests')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                  <FileText size={24} color="#f59e0b" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Tüm Talepler</Text>
                  <Text style={styles.actionDesc}>Tüm talepleri görüntüle ve yönet</Text>
                </View>
              </TouchableOpacity>

              {profile?.role === 'project_manager' && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push('/manager/completed-services')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#d1fae5' }]}>
                    <CheckCircle size={24} color="#10b981" />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionTitle}>Tamamlanan Hizmetler</Text>
                    <Text style={styles.actionDesc}>Hizmetleri değerlendir</Text>
                  </View>
                </TouchableOpacity>
              )}

              {profile?.role === 'admin' && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push('/technical/companies')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#e0e7ff' }]}>
                    <Building2 size={24} color="#6366f1" />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionTitle}>Teknik Firmalar</Text>
                    <Text style={styles.actionDesc}>Teknik firmaları yönet</Text>
                  </View>
                </TouchableOpacity>
              )}

              {profile?.role === 'admin' && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push('/admin/technical-service-invoices')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                    <DollarSign size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionTitle}>Teknik Servis Hakedişleri</Text>
                    <Text style={styles.actionDesc}>Hakediş oluştur ve yönet</Text>
                  </View>
                </TouchableOpacity>
              )}

              {profile?.role === 'admin' && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push('/admin/project-technical-invoices')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
                    <DollarSign size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionTitle}>Proje Teknik Hakedişleri</Text>
                    <Text style={styles.actionDesc}>Müşteriye sunulacak hakedişler</Text>
                  </View>
                </TouchableOpacity>
              )}
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
  topListCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeFirst: {
    backgroundColor: '#fef3c7',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  rankTextFirst: {
    color: '#f59e0b',
  },
  topListIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topListLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },
  topListSubLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  topListBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  topListCount: {
    fontSize: 16,
    fontWeight: '700',
  },
});
