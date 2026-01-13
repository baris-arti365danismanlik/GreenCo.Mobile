import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users, ChevronRight, X, UserPlus, UserMinus, Search, MapPin, Briefcase, DollarSign } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Project = {
  id: string;
  name: string;
  address: string | null;
  start_date: string;
  end_date: string;
  personnel_count: number;
};

type Personnel = {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  district: string;
  personnel_type_id: string | null;
  profile_personnel_types?: Array<{ personnel_types: { name: string } }>;
  personnel_types?: { name: string } | null;
  is_assigned?: boolean;
};

type PersonnelType = {
  id: string;
  name: string;
};

export default function ProjectPersonnelScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [assignedPersonnel, setAssignedPersonnel] = useState<Personnel[]>([]);
  const [allPersonnel, setAllPersonnel] = useState<Personnel[]>([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([]);
  const [personnelTypes, setPersonnelTypes] = useState<PersonnelType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  useEffect(() => {
    loadProjects();
    loadPersonnelTypes();
  }, []);

  useEffect(() => {
    if (addModalVisible && allPersonnel.length > 0) {
      filterAvailablePersonnel();
    }
  }, [searchQuery, selectedType, allPersonnel, assignedPersonnel]);

  const loadProjects = async () => {
    try {
      const { data: projectsData, error } = await supabase
        .from('projects_greenco')
        .select('id, name, address, start_date, end_date')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const projectsWithCounts = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { count } = await supabase
            .from('project_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .is('removed_at', null);

          return {
            ...project,
            personnel_count: count || 0,
          };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error('Proje yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPersonnelTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('personnel_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPersonnelTypes(data || []);
    } catch (error) {
      console.error('Personel tipleri yükleme hatası:', error);
    }
  };

  const handleProjectSelect = async (project: Project) => {
    setSelectedProject(project);
    setModalVisible(true);
    await loadProjectPersonnel(project.id);
  };

  const loadProjectPersonnel = async (projectId: string) => {
    try {
      const { data: assignments, error } = await supabase
        .from('project_assignments')
        .select(`
          personnel_id,
          profiles!project_assignments_personnel_id_fkey(
            id,
            full_name,
            phone,
            city,
            district,
            personnel_type_id,
            personnel_types(name),
            profile_personnel_types(
              personnel_types(name)
            )
          )
        `)
        .eq('project_id', projectId)
        .is('removed_at', null);

      if (error) throw error;

      const personnel = assignments?.map((a: any) => ({
        ...a.profiles,
        is_assigned: true,
      })) || [];

      setAssignedPersonnel(personnel);
    } catch (error) {
      console.error('Personel yükleme hatası:', error);
    }
  };

  const handleOpenAddModal = async () => {
    setAddModalVisible(true);
    setSearchQuery('');
    setSelectedType('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone,
          city,
          district,
          personnel_type_id,
          profile_personnel_types(
            personnel_types(name)
          )
        `)
        .eq('role', 'personnel')
        .eq('is_active', true);

      if (error) throw error;
      setAllPersonnel(data || []);
    } catch (error) {
      console.error('Personel listesi yükleme hatası:', error);
    }
  };

  const filterAvailablePersonnel = () => {
    const assignedIds = assignedPersonnel.map(p => p.id);

    let filtered = allPersonnel.filter(p => !assignedIds.includes(p.id));

    if (selectedType) {
      filtered = filtered.filter(p => p.personnel_type_id === selectedType);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(p =>
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPersonnel(filtered);
  };

  const handleSelectPersonnel = (personnelId: string) => {
    setSelectedPersonnelId(personnelId);
    setHourlyRate('');
    setDailyRate('');
    setRateModalVisible(true);
  };

  const handleSaveRate = async () => {
    if (!selectedProject || !selectedPersonnelId) return;

    if (!hourlyRate && !dailyRate) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen en az bir ücret türü girin');
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('project_assignments')
        .insert({
          project_id: selectedProject.id,
          personnel_id: selectedPersonnelId,
          hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
          package_rate: dailyRate ? parseFloat(dailyRate) : null,
        });

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Personel başarıyla atandı');
      }

      await loadProjectPersonnel(selectedProject.id);
      setRateModalVisible(false);
      setAddModalVisible(false);
      setSelectedPersonnelId(null);
      setHourlyRate('');
      setDailyRate('');
    } catch (error: any) {
      console.error('Personel atama hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Personel atanamadı'));
      }
    }
  };

  const handleRemovePersonnel = async (personnelId: string) => {
    if (!selectedProject) return;

    const confirmed = Platform.OS === 'web'
      ? window.confirm('Bu personeli projeden çıkarmak istediğinize emin misiniz?')
      : true;

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('project_assignments')
        .update({ removed_at: new Date().toISOString() })
        .eq('project_id', selectedProject.id)
        .eq('personnel_id', personnelId)
        .is('removed_at', null);

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Personel başarıyla çıkarıldı');
      }

      await loadProjectPersonnel(selectedProject.id);

      setProjects(projects.map(p =>
        p.id === selectedProject.id
          ? { ...p, personnel_count: p.personnel_count - 1 }
          : p
      ));
    } catch (error: any) {
      console.error('Personel çıkarma hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Personel çıkarılamadı'));
      }
    }
  };

  const groupPersonnelByType = () => {
    const grouped: { [key: string]: Personnel[] } = {};

    assignedPersonnel.forEach(person => {
      const typeName = person.personnel_types?.name || 'Belirsiz';
      if (!grouped[typeName]) {
        grouped[typeName] = [];
      }
      grouped[typeName].push(person);
    });

    return grouped;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Proje Personelleri</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proje Personelleri</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.searchBox}>
          <Search size={20} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Proje ara..."
            value={projectSearchQuery}
            onChangeText={setProjectSearchQuery}
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <Text style={styles.sectionTitle}>AKTİF PROJELER</Text>

        {projects.filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())).length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>
              {projectSearchQuery ? 'Aranan kriterlere uygun proje bulunamadı' : 'Aktif proje bulunamadı'}
            </Text>
          </View>
        ) : (
          projects
            .filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()))
            .map((project) => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => handleProjectSelect(project)}
              >
                <View style={styles.projectHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    {project.address && (
                      <Text style={styles.projectAddress}>{project.address}</Text>
                    )}
                    <Text style={styles.projectDates}>
                      {project.start_date} - {project.end_date}
                    </Text>
                  </View>
                  <ChevronRight size={24} color={COLORS.textLight} />
                </View>
                <View style={styles.projectFooter}>
                  <Users size={16} color={COLORS.primary} />
                  <Text style={styles.personnelCount}>
                    {project.personnel_count} Personel
                  </Text>
                </View>
              </TouchableOpacity>
            ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedProject?.name}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {assignedPersonnel.length === 0 ? (
                <View style={styles.emptyState}>
                  <Users size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>Bu projede atanmış personel yok</Text>
                </View>
              ) : (
                Object.entries(groupPersonnelByType()).map(([typeName, personnel]) => (
                  <View key={typeName} style={styles.typeGroup}>
                    <Text style={styles.typeTitle}>{typeName} ({personnel.length})</Text>
                    {personnel.map((person) => (
                      <View key={person.id} style={styles.personnelItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.personnelName}>{person.full_name}</Text>
                          <View style={styles.personnelDetails}>
                            <MapPin size={12} color={COLORS.textLight} />
                            <Text style={styles.personnelLocation}>
                              {person.district}, {person.city}
                            </Text>
                          </View>
                          <Text style={styles.personnelPhone}>{person.phone}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemovePersonnel(person.id)}
                        >
                          <UserMinus size={20} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.addButton}
              onPress={handleOpenAddModal}
            >
              <UserPlus size={20} color="white" />
              <Text style={styles.addButtonText}>Personel Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personel Ekle</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterContainer}>
              <View style={styles.searchBox}>
                <Search size={20} color={COLORS.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="İsim ara..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.typeFilters}
                contentContainerStyle={styles.typeFiltersContent}
              >
                <TouchableOpacity
                  style={[styles.typeFilterButton, !selectedType && styles.typeFilterButtonActive]}
                  onPress={() => setSelectedType('')}
                >
                  <Text style={[styles.typeFilterText, !selectedType && styles.typeFilterTextActive]}>
                    Tümü
                  </Text>
                </TouchableOpacity>
                {personnelTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeFilterButton, selectedType === type.id && styles.typeFilterButtonActive]}
                    onPress={() => setSelectedType(type.id)}
                  >
                    <Text style={[styles.typeFilterText, selectedType === type.id && styles.typeFilterTextActive]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.modalBody}>
              {filteredPersonnel.length === 0 ? (
                <View style={styles.emptyState}>
                  <Users size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>Uygun personel bulunamadı</Text>
                </View>
              ) : (
                filteredPersonnel.map((person) => (
                  <TouchableOpacity
                    key={person.id}
                    style={styles.selectablePersonnelItem}
                    onPress={() => handleSelectPersonnel(person.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personnelName}>{person.full_name}</Text>
                      <View style={styles.personnelDetails}>
                        <Briefcase size={12} color={COLORS.textLight} />
                        <Text style={styles.personnelType}>
                          {person.profile_personnel_types && person.profile_personnel_types.length > 0
                            ? person.profile_personnel_types.map(ppt => ppt.personnel_types.name).join(', ')
                            : 'Belirsiz'}
                        </Text>
                      </View>
                      <View style={styles.personnelDetails}>
                        <MapPin size={12} color={COLORS.textLight} />
                        <Text style={styles.personnelLocation}>
                          {person.district}, {person.city}
                        </Text>
                      </View>
                    </View>
                    <UserPlus size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={rateModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.rateModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.rateModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ücret Bilgileri</Text>
              <TouchableOpacity onPress={() => setRateModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.rateModalBody}>
              <Text style={styles.rateDescription}>
                Personel için ücret bilgilerini girin (en az bir tanesi zorunlu)
              </Text>

              <View style={styles.rateInputGroup}>
                <View style={styles.rateInputIcon}>
                  <DollarSign size={20} color={COLORS.primary} />
                </View>
                <View style={styles.rateInputWrapper}>
                  <Text style={styles.rateInputLabel}>Saatlik Ücret</Text>
                  <TextInput
                    style={styles.rateInput}
                    placeholder="Örn: 150"
                    keyboardType="numeric"
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
              </View>

              <View style={styles.rateInputGroup}>
                <View style={styles.rateInputIcon}>
                  <DollarSign size={20} color={COLORS.primary} />
                </View>
                <View style={styles.rateInputWrapper}>
                  <Text style={styles.rateInputLabel}>Günlük Ücret</Text>
                  <TextInput
                    style={styles.rateInput}
                    placeholder="Örn: 1200"
                    keyboardType="numeric"
                    value={dailyRate}
                    onChangeText={setDailyRate}
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
              </View>

              <View style={styles.rateModalActions}>
                <TouchableOpacity
                  style={styles.rateCancelButton}
                  onPress={() => setRateModalVisible(false)}
                >
                  <Text style={styles.rateCancelButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rateSaveButton}
                  onPress={handleSaveRate}
                >
                  <Text style={styles.rateSaveButtonText}>Kaydet ve Ata</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  content: {
    flex: 1,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  projectCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  projectAddress: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  projectDates: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  projectFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  personnelCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
    flex: 1,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  typeGroup: {
    marginBottom: 20,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  personnelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    marginBottom: 8,
  },
  personnelName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  personnelDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  personnelLocation: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  personnelType: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  personnelPhone: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  removeButton: {
    padding: 8,
    backgroundColor: COLORS.error + '20',
    borderRadius: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    padding: 16,
    margin: 20,
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  filterContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  typeFilters: {
    marginTop: 10,
    flexGrow: 0,
    flexShrink: 0,
  },
  typeFiltersContent: {
    paddingRight: 15,
    alignItems: 'center',
  },
  typeFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    marginRight: 8,
  },
  typeFilterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeFilterTextActive: {
    color: 'white',
  },
  selectablePersonnelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  rateModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  rateModalBody: {
    padding: 20,
  },
  rateDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 20,
  },
  rateInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  rateInputIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateInputWrapper: {
    flex: 1,
  },
  rateInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  rateInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: 'white',
  },
  rateModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  rateCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  rateCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  rateSaveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  rateSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
