import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, UserPlus, MapPin, Briefcase, CheckCircle, X, DollarSign, Star, User } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type PersonnelType = {
  id: string;
  name: string;
};

type Personnel = {
  id: string;
  user_id?: string;
  full_name: string;
  phone: string;
  position?: string;
  personnel_type_id: string | null;
  city: string;
  district: string;
  is_active?: boolean;
  avatar_url?: string | null;
  personnel_types?: { id: string; name: string }[];
  assignedProjects?: string[];
  rating?: number;
};

type RequestPosition = {
  personnel_type_id?: string;
  type?: string;
  position?: string;
  count?: number;
  quantity?: number;
  criminal_record?: string;
  certificates?: string[];
  is_change_request?: boolean;
  shiftHours?: string;
  requirements?: string;
};

type Request = {
  id: string;
  project_id: string;
  project_name: string;
  city: string;
  district: string;
  status?: string;
  personnel_positions: RequestPosition[];
};

export default function AssignPersonnelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const requestId = params.requestId as string;

  const [request, setRequest] = useState<Request | null>(null);
  const [personnelTypes, setPersonnelTypes] = useState<PersonnelType[]>([]);
  const [allPersonnel, setAllPersonnel] = useState<Personnel[]>([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByPosition, setFilterByPosition] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [personnelRates, setPersonnelRates] = useState<{ [key: string]: { hourly: string; daily: string } }>({});
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [currentPersonnelId, setCurrentPersonnelId] = useState<string | null>(null);
  const [tempHourlyRate, setTempHourlyRate] = useState('');
  const [tempDailyRate, setTempDailyRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [existingAssignedCount, setExistingAssignedCount] = useState(0);
  const [existingAssignedIds, setExistingAssignedIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [requestId]);

  useEffect(() => {
    if (request && allPersonnel.length > 0) {
      filterPersonnel();
    }
  }, [selectedPosition, searchQuery, request, allPersonnel, filterByPosition, selectedCity, selectedDistrict]);

  const loadData = async () => {
    try {
      const [requestRes, typesRes, personnelRes] = await Promise.all([
        supabase
          .from('personnel_requests')
          .select('id, project_id, project_name, city, district, personnel_positions')
          .eq('id', requestId)
          .single(),
        supabase
          .from('personnel_types')
          .select('id, name')
          .eq('is_active', true),
        supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            phone,
            city,
            district,
            personnel_type_id,
            avatar_url
          `)
          .eq('role', 'personnel')
          .eq('is_active', true)
      ]);

      if (requestRes.error) throw requestRes.error;

      if (requestRes.data) {
        setRequest(requestRes.data);

        // Mevcut atanmış personelleri yükle
        if (requestRes.data.project_id) {
          const { data: assignments } = await supabase
            .from('project_assignments')
            .select('personnel_id')
            .eq('project_id', requestRes.data.project_id)
            .is('removed_at', null);

          if (assignments) {
            const assignedIds = assignments.map(a => a.personnel_id);
            setSelectedPersonnel(assignedIds);
            setExistingAssignedCount(assignedIds.length);
            setExistingAssignedIds(assignedIds);
          }
        }
      }

      if (typesRes.data) setPersonnelTypes(typesRes.data);

      if (personnelRes.data) {
        const { data: allAssignments } = await supabase
          .from('project_assignments')
          .select('personnel_id, project_id, projects_greenco(name)')
          .is('removed_at', null);

        const { data: personnelTypesJunction } = await supabase
          .from('profile_personnel_types')
          .select(`
            profile_id,
            personnel_type_id,
            personnel_types(id, name)
          `);

        const personnelWithAssignments = personnelRes.data.map(p => {
          const typesForPerson = personnelTypesJunction
            ?.filter(ppt => ppt.profile_id === p.id)
            .map(ppt => ({
              id: (ppt.personnel_types as any)?.id,
              name: (ppt.personnel_types as any)?.name
            }))
            .filter(t => t.id && t.name) || [];

          return {
            ...p,
            personnel_types: typesForPerson,
            assignedProjects: allAssignments
              ?.filter(a => a.personnel_id === p.id)
              .map(a => (a.projects_greenco as any)?.name)
              .filter(Boolean) || [],
            rating: 4.0 + Math.random() * 1.0
          };
        });

        setAllPersonnel(personnelWithAssignments);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPersonnel = () => {
    if (!request) return;

    const position = request.personnel_positions[selectedPosition];
    if (!position) return;

    let filtered = allPersonnel.filter(p => {
      let positionMatch = !filterByPosition;

      if (filterByPosition && position.personnel_type_id) {
        // Personelin meslek listesinde aranan meslek var mı kontrol et
        positionMatch = p.personnel_types?.some(pt => pt.id === position.personnel_type_id) || false;
      }

      const cityMatch = !selectedCity || (p.city && p.city.toLowerCase() === selectedCity.toLowerCase());
      const districtMatch = !selectedDistrict || (p.district && p.district.toLowerCase() === selectedDistrict.toLowerCase());

      const nameMatch = searchQuery.trim() === '' ||
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      return positionMatch && cityMatch && districtMatch && nameMatch;
    });

    setFilteredPersonnel(filtered);
  };

  const togglePersonnelSelection = (personnelId: string) => {
    if (selectedPersonnel.includes(personnelId)) {
      setSelectedPersonnel(selectedPersonnel.filter(id => id !== personnelId));
      const { [personnelId]: removed, ...rest } = personnelRates;
      setPersonnelRates(rest);
    } else {
      // Toplam gereken personel sayısını hesapla (mevcut + yeni talep)
      const newRequestCount = request?.personnel_positions.reduce(
        (sum, pos) => sum + (pos.count || pos.quantity || 0),
        0
      ) || 0;
      const totalRequired = existingAssignedCount + newRequestCount;

      if (selectedPersonnel.length < totalRequired) {
        setCurrentPersonnelId(personnelId);
        setTempHourlyRate('');
        setTempDailyRate('');
        setRateModalVisible(true);
      } else {
        alert(`Toplam ${totalRequired} personel seçebilirsiniz`);
      }
    }
  };

  const handleSaveRate = () => {
    if (!currentPersonnelId) return;

    if (!tempHourlyRate && !tempDailyRate) {
      alert('Lütfen en az bir ücret türü girin');
      return;
    }

    setPersonnelRates({
      ...personnelRates,
      [currentPersonnelId]: {
        hourly: tempHourlyRate,
        daily: tempDailyRate,
      },
    });

    setSelectedPersonnel([...selectedPersonnel, currentPersonnelId]);
    setRateModalVisible(false);
    setCurrentPersonnelId(null);
    setTempHourlyRate('');
    setTempDailyRate('');
  };

  const handleAssign = async () => {
    if (!request) return;

    // Toplam gereken personel sayısını hesapla (mevcut + yeni talep)
    const newRequestCount = request.personnel_positions.reduce(
      (sum, pos) => sum + (pos.count || pos.quantity || 0),
      0
    );
    const totalRequired = existingAssignedCount + newRequestCount;

    if (selectedPersonnel.length !== totalRequired) {
      alert(`Lütfen tam olarak ${totalRequired} personel seçin. Şu an ${selectedPersonnel.length} personel seçtiniz.`);
      return;
    }

    const confirmed = confirm(
      `${selectedPersonnel.length} personeli ${request.project_name} projesine atamak istediğinize emin misiniz?`
    );
    if (!confirmed) return;

    setAssigning(true);
    try {
      // Sadece YENİ seçilen personelleri filtrele (mevcut atananları hariç tut)
      const newlySelectedPersonnel = selectedPersonnel.filter(
        id => !existingAssignedIds.includes(id)
      );

      // Eğer yeni personel varsa, onları ekle
      if (newlySelectedPersonnel.length > 0) {
        const assignments = newlySelectedPersonnel.map(personnelId => {
          const rates = personnelRates[personnelId];
          return {
            project_id: request.project_id,
            personnel_id: personnelId,
            assigned_at: new Date().toISOString(),
            hourly_rate: rates?.hourly ? parseFloat(rates.hourly) : null,
            package_rate: rates?.daily ? parseFloat(rates.daily) : null,
          };
        });

        const { error: assignError } = await supabase
          .from('project_assignments')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      const isLastPosition = selectedPosition >= request.personnel_positions.length - 1;

      if (isLastPosition) {
        const { error: updateError } = await supabase
          .from('personnel_requests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) {
          console.error('Talep güncelleme hatası:', updateError);
        }

        alert('Başarılı! Tüm personel atamaları tamamlandı ve talep onaylandı.');
        router.push('/admin');
      } else {
        alert('Başarılı! Personeller projeye atandı.');
        setSelectedPosition(selectedPosition + 1);
        setSelectedPersonnel([]);
        setSearchQuery('');
      }
    } catch (error: any) {
      console.error('Atama hatası:', error);
      alert('Hata: ' + (error.message || 'Atama başarısız. Lütfen tekrar deneyin.'));
    } finally {
      setAssigning(false);
    }
  };

  if (loading || !request) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  if (request.status === 'completed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personel Ata</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.completedContainer}>
          <CheckCircle size={64} color={COLORS.success} />
          <Text style={styles.completedTitle}>Atamalar Tamamlandı</Text>
          <Text style={styles.completedText}>
            Bu talep için tüm personel atamaları tamamlanmıştır.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/admin')}
          >
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentPosition = request.personnel_positions[selectedPosition];
  const positionType = personnelTypes.find(t =>
    t.id === currentPosition?.personnel_type_id ||
    t.name === currentPosition?.position ||
    t.name === currentPosition?.type
  );

  const availableCities = request.city ? [request.city] : [];
  const availableDistricts = request.district ? [request.district] : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/admin')}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personel Ata</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.projectInfo}>
            <Text style={styles.projectName}>{request.project_name}</Text>
            <Text style={styles.positionInfo}>
              Pozisyon {selectedPosition + 1} / {request.personnel_positions.length}
            </Text>
          </View>

          <View style={styles.positionCard}>
            <View style={styles.positionRow}>
              <Briefcase size={18} color={COLORS.primary} />
              <Text style={styles.positionLabel}>Meslek:</Text>
              <Text style={styles.positionValue}>{positionType?.name || 'Bilinmiyor'}</Text>
            </View>
            {request.city && request.district && (
              <View style={styles.positionRow}>
                <MapPin size={18} color={COLORS.primary} />
                <Text style={styles.positionLabel}>Konum:</Text>
                <Text style={styles.positionValue}>{request.city}, {request.district}</Text>
              </View>
            )}
            <View style={styles.positionRow}>
              <UserPlus size={18} color={COLORS.primary} />
              <Text style={styles.positionLabel}>Gerekli:</Text>
              <Text style={styles.positionValue}>
                {existingAssignedCount + request.personnel_positions.reduce((sum, pos) => sum + (pos.count || pos.quantity || 0), 0)} / {selectedPersonnel.length} seçildi
              </Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color={COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Personel ara..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterContainer}>
            <Text style={styles.filterTitle}>Filtreler:</Text>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[styles.filterButton, filterByPosition && styles.filterButtonActive]}
                onPress={() => setFilterByPosition(!filterByPosition)}
              >
                <Text style={[styles.filterButtonText, filterByPosition && styles.filterButtonTextActive]}>
                  Pozisyon: {positionType?.name || currentPosition?.position || currentPosition?.type || 'Tümü'}
                </Text>
              </TouchableOpacity>
            </View>

            {availableCities.length > 0 && (
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>İl:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
                  <TouchableOpacity
                    style={[styles.dropdownButton, !selectedCity && styles.dropdownButtonActive]}
                    onPress={() => { setSelectedCity(''); setSelectedDistrict(''); }}
                  >
                    <Text style={[styles.dropdownButtonText, !selectedCity && styles.dropdownButtonTextActive]}>
                      Tümü
                    </Text>
                  </TouchableOpacity>
                  {availableCities.map(city => (
                    <TouchableOpacity
                      key={city}
                      style={[styles.dropdownButton, selectedCity === city && styles.dropdownButtonActive]}
                      onPress={() => { setSelectedCity(city); setSelectedDistrict(''); }}
                    >
                      <Text style={[styles.dropdownButtonText, selectedCity === city && styles.dropdownButtonTextActive]}>
                        {city.charAt(0).toUpperCase() + city.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {availableDistricts.length > 0 && (
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>İlçe:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
                  <TouchableOpacity
                    style={[styles.dropdownButton, !selectedDistrict && styles.dropdownButtonActive]}
                    onPress={() => setSelectedDistrict('')}
                  >
                    <Text style={[styles.dropdownButtonText, !selectedDistrict && styles.dropdownButtonTextActive]}>
                      Tümü
                    </Text>
                  </TouchableOpacity>
                  {availableDistricts.map(district => (
                    <TouchableOpacity
                      key={district}
                      style={[styles.dropdownButton, selectedDistrict === district && styles.dropdownButtonActive]}
                      onPress={() => setSelectedDistrict(district)}
                    >
                      <Text style={[styles.dropdownButtonText, selectedDistrict === district && styles.dropdownButtonTextActive]}>
                        {district.charAt(0).toUpperCase() + district.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.personnelList}>
            <Text style={styles.sectionTitle}>
              TÜM PERSONEL ({filteredPersonnel.length})
            </Text>

            {filteredPersonnel.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Bu kriterlere uygun personel bulunamadı</Text>
              </View>
            ) : (
              filteredPersonnel.map(person => {
                const personnelTypeName = person.personnel_types && person.personnel_types.length > 0
                  ? person.personnel_types.map(pt => pt.name).join(', ')
                  : 'Meslek belirtilmemiş';

                return (
                  <TouchableOpacity
                    key={person.id}
                    style={[
                      styles.personCard,
                      selectedPersonnel.includes(person.id) && styles.personCardSelected,
                    ]}
                    onPress={() => togglePersonnelSelection(person.id)}
                  >
                    <View style={styles.personCardLeft}>
                      {person.avatar_url ? (
                        <Image
                          source={{ uri: person.avatar_url }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <User size={24} color={COLORS.textLight} />
                        </View>
                      )}

                      <View style={styles.personInfo}>
                        <Text style={styles.personName}>{person.full_name}</Text>

                        <View style={styles.personMetaRow}>
                          <Briefcase size={14} color={COLORS.primary} />
                          <Text style={styles.personMeta}>{personnelTypeName}</Text>
                        </View>

                        {person.rating && (
                          <View style={styles.personMetaRow}>
                            <Star size={14} color="#FFB800" />
                            <Text style={styles.personRating}>{person.rating.toFixed(1)}</Text>
                          </View>
                        )}

                        {person.phone && (
                          <Text style={styles.personDetail}>{person.phone}</Text>
                        )}
                        {person.city && person.district && (
                          <View style={styles.personMetaRow}>
                            <MapPin size={14} color={COLORS.textLight} />
                            <Text style={styles.personDetail}>
                              {person.city}, {person.district}
                            </Text>
                          </View>
                        )}
                        {person.assignedProjects && person.assignedProjects.length > 0 && (
                          <Text style={styles.assignedProjectsText}>
                            Atandığı projeler: {person.assignedProjects.join(', ')}
                          </Text>
                        )}
                        {selectedPersonnel.includes(person.id) && personnelRates[person.id] && (
                          <View style={styles.rateInfo}>
                            {personnelRates[person.id].hourly && (
                              <Text style={styles.rateText}>Saatlik Ücret: {personnelRates[person.id].hourly} ₺</Text>
                            )}
                            {personnelRates[person.id].daily && (
                              <Text style={styles.rateText}>Günlük Ücret: {personnelRates[person.id].daily} ₺</Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>

                    {selectedPersonnel.includes(person.id) && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.assignButton,
            (selectedPersonnel.length !== (existingAssignedCount + request.personnel_positions.reduce((sum, pos) => sum + (pos.count || pos.quantity || 0), 0)) || assigning) && styles.assignButtonDisabled,
          ]}
          onPress={handleAssign}
          disabled={selectedPersonnel.length !== (existingAssignedCount + request.personnel_positions.reduce((sum, pos) => sum + (pos.count || pos.quantity || 0), 0)) || assigning}
        >
          <UserPlus size={20} color="white" />
          <Text style={styles.assignButtonText}>
            {assigning ? 'Atanıyor...' : `${selectedPersonnel.length} Personeli Ata`}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={rateModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ücret Bilgileri</Text>
              <TouchableOpacity onPress={() => setRateModalVisible(false)}>
                <X size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Personel için ücret bilgilerini girin (en az bir tanesi zorunlu)
              </Text>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <DollarSign size={20} color={COLORS.primary} />
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Saatlik Ücret</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: 150"
                    keyboardType="numeric"
                    value={tempHourlyRate}
                    onChangeText={setTempHourlyRate}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <DollarSign size={20} color={COLORS.primary} />
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Günlük Ücret</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: 1200"
                    keyboardType="numeric"
                    value={tempDailyRate}
                    onChangeText={setTempDailyRate}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setRateModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveRate}
                >
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
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
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: COLORS.textLight,
  },
  projectInfo: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  projectName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  positionInfo: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  positionCard: {
    margin: 20,
    padding: 16,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 12,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  positionValue: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  filterContainer: {
    padding: 20,
    paddingTop: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    letterSpacing: 1,
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'white',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  personnelList: {
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    letterSpacing: 1,
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  personCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  personCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  personCardLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.bg,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  personMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  personMeta: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  personRating: {
    fontSize: 13,
    color: '#FFB800',
    fontWeight: '700',
  },
  personDetail: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  assignedProjectsText: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  assignButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 10,
  },
  assignButtonDisabled: {
    opacity: 0.5,
  },
  assignButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownContainer: {
    marginTop: 12,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  dropdownScroll: {
    flexGrow: 0,
  },
  dropdownButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  dropdownButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  dropdownButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  completedText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rateInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 6,
  },
  rateText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 20,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  inputIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: 'white',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
