import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, User, X, Calendar, Clock } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Personnel = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  city: string | null;
  district: string | null;
  company?: { name: string };
};

export default function AdminPersonnel() {
  const router = useRouter();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadPersonnel();
  }, [page, searchQuery, cityFilter, districtFilter]);

  const loadPersonnel = async () => {
    try {
      setLoading(true);
      console.log('loadPersonnel başladı (admin) - sayfa:', page);

      const today = new Date().toISOString().split('T')[0];
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('profiles')
        .select('id, full_name, phone, role, city, district, avatar_url, companies(name)', { count: 'exact' })
        .eq('role', 'personnel')
        .order('full_name', { ascending: true })
        .range(from, to);

      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        query = query.or(`full_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`);
      }

      if (cityFilter.trim()) {
        query = query.ilike('city', `%${cityFilter}%`);
      }

      if (districtFilter.trim()) {
        query = query.ilike('district', `%${districtFilter}%`);
      }

      const attendancePromise = supabase
        .from('attendance_records')
        .select('worker_id, check_in_time, check_out_time, shifts!inner(shift_date)')
        .eq('shifts.shift_date', today);

      const [profilesResult, attendanceResult] = await Promise.all([
        query,
        attendancePromise
      ]);

      if (profilesResult.error) throw profilesResult.error;

      const activeWorkerIds = new Set(
        (attendanceResult.data || [])
          .filter(record => record.check_in_time && !record.check_out_time)
          .map(record => record.worker_id)
      );

      const personnelWithStatus = (profilesResult.data || []).map((person: any) => ({
        ...person,
        is_active: activeWorkerIds.has(person.id),
        company: person.companies ? { name: person.companies.name } : undefined,
      }));

      setPersonnel(personnelWithStatus);
      setFilteredPersonnel(personnelWithStatus);
      setTotalCount(profilesResult.count || 0);
      console.log('Personnel yüklendi, sayfa:', page, 'toplam:', profilesResult.count);
    } catch (error) {
      console.error('Personnel yükleme hatası:', error);
      Alert.alert('Hata', 'Personeller yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const paginatedPersonnel = filteredPersonnel;

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const clearFilters = () => {
    setSearchQuery('');
    setCityFilter('');
    setDistrictFilter('');
    setPage(1);
  };

  const openModal = (person: Personnel) => {
    setSelectedPersonnel(person);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPersonnel(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personel Detayları</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <Search size={20} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="İsim veya telefon ara..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          <TextInput
            style={styles.filterInput}
            placeholder="Şehir"
            value={cityFilter}
            onChangeText={setCityFilter}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="İlçe"
            value={districtFilter}
            onChangeText={setDistrictFilter}
          />
          <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
            <X size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            Toplam {totalCount} personel | Sayfa {page}/{totalPages}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.emptyText}>Yükleniyor...</Text>
        ) : filteredPersonnel.length === 0 ? (
          <Text style={styles.emptyText}>Personel bulunamadı</Text>
        ) : (
          paginatedPersonnel.map((person) => (
            <TouchableOpacity
              key={person.id}
              style={styles.personCard}
              onPress={() => openModal(person)}
            >
              <View style={styles.personIcon}>
                <User size={20} color={COLORS.primary} />
              </View>
              <View style={styles.personInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.personName}>{person.full_name}</Text>
                  {person.is_active && (
                    <View style={styles.workingBadge}>
                      <Clock size={10} color={COLORS.success} />
                      <Text style={styles.workingText}>Mesaide</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.personDetail}>Personel</Text>
                {person.phone && <Text style={styles.personPhone}>{person.phone}</Text>}
                {person.company && <Text style={styles.personCompany}>{person.company.name}</Text>}
              </View>
            </TouchableOpacity>
          ))
        )}

        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
              onPress={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <Text style={styles.pageBtnText}>← Önceki</Text>
            </TouchableOpacity>

            <Text style={styles.pageText}>
              {page} / {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
              onPress={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              <Text style={styles.pageBtnText}>Sonraki →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personel Detayı</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeIconBtn}>
                <X size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Ad Soyad</Text>
                <Text style={styles.infoValue}>{selectedPersonnel?.full_name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefon</Text>
                <Text style={styles.infoValue}>{selectedPersonnel?.phone || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rol</Text>
                <Text style={styles.infoValue}>Personel</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Durum</Text>
                <Text style={[styles.infoValue, { color: selectedPersonnel?.is_active ? COLORS.success : COLORS.danger }]}>
                  {selectedPersonnel?.is_active ? 'Aktif' : 'Pasif'}
                </Text>
              </View>

              {selectedPersonnel?.city && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Şehir</Text>
                  <Text style={styles.infoValue}>{selectedPersonnel.city}</Text>
                </View>
              )}

              {selectedPersonnel?.district && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>İlçe</Text>
                  <Text style={styles.infoValue}>{selectedPersonnel.district}</Text>
                </View>
              )}

              {selectedPersonnel?.company && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Firma</Text>
                  <Text style={styles.infoValue}>{selectedPersonnel.company.name}</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                closeModal();
                router.push(`/admin/personnel-attendance?personnelId=${selectedPersonnel?.id}`);
              }}
            >
              <Calendar size={20} color="white" />
              <Text style={styles.actionBtnText}>Devam Detayı</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
              <Text style={styles.closeBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  filtersContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
  },
  clearBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsRow: {
    alignItems: 'center',
  },
  statsText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  pageBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  pageBtnText: {
    color: 'white',
    fontWeight: '600',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 40,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  personDetail: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 2,
  },
  personPhone: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  personCompany: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  closeIconBtn: {
    padding: 4,
  },
  modalScroll: {
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.secondary,
  },
  documentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  documentTag: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  documentText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  closeBtn: {
    backgroundColor: COLORS.border,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  workingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  workingText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
  },
});
