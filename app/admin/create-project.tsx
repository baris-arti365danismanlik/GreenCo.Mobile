import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Send, CheckCircle, Building2, Pencil } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Company = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  name: string;
  project_manager_id?: string;
};

type Manager = {
  id: string;
  full_name: string;
  phone: string;
};

type PersonnelPosition = {
  type: string;
  count: string;
  criminal_record: string;
  certificates: string;
  isEditing?: boolean;
};

type PersonnelType = {
  id: string;
  name: string;
};

import { TURKISH_CITIES, DISTRICTS } from '@/constants/locations';

const CRIMINAL_RECORD_OPTIONS = ['yok', 'var'];

export default function AdminCreateProjectScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { title, mode } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<'company' | 'project-type' | 'form'>('company');
  const [isNewProject, setIsNewProject] = useState(false);

  // ... (existing code)



  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [managers, setManagers] = useState<Manager[]>([]);
  const [filteredManagers, setFilteredManagers] = useState<Manager[]>([]);
  const [managerSearch, setManagerSearch] = useState('');
  const [personnelTypes, setPersonnelTypes] = useState<PersonnelType[]>([]);
  const [filteredPersonnelTypes, setFilteredPersonnelTypes] = useState<PersonnelType[]>([]);
  const [personnelTypeSearch, setPersonnelTypeSearch] = useState('');
  const [showNewTypeModal, setShowNewTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingNewType, setAddingNewType] = useState(false);

  const [projectCity, setProjectCity] = useState('');
  const [projectDistrict, setProjectDistrict] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [filteredCities, setFilteredCities] = useState<string[]>(TURKISH_CITIES);
  const [filteredDistricts, setFilteredDistricts] = useState<string[]>([]);

  const [selectedProject, setSelectedProject] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');

  const [selectedManager, setSelectedManager] = useState('');
  const [isNewManager, setIsNewManager] = useState(false);
  const [managerFullName, setManagerFullName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerPassword, setManagerPassword] = useState('');

  const [positions, setPositions] = useState<PersonnelPosition[]>([
    { type: '', count: '', criminal_record: 'yok', certificates: '', isEditing: true }
  ]);

  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    const filtered = companies.filter(company =>
      company.name.toLowerCase().includes(companySearch.toLowerCase())
    );
    setFilteredCompanies(filtered);
  }, [companySearch, companies]);

  useEffect(() => {
    const filtered = projects.filter(project =>
      project.name.toLowerCase().includes(projectSearch.toLowerCase())
    );
    setFilteredProjects(filtered);
  }, [projectSearch, projects]);

  useEffect(() => {
    const filtered = managers.filter(manager =>
      manager.full_name.toLowerCase().includes(managerSearch.toLowerCase())
    );
    setFilteredManagers(filtered);
  }, [managerSearch, managers]);

  useEffect(() => {
    if (personnelTypes.length > 0) {
      const filtered = personnelTypes.filter(type =>
        type.name.toLowerCase().includes(personnelTypeSearch.toLowerCase())
      );
      setFilteredPersonnelTypes(filtered);
    }
  }, [personnelTypeSearch, personnelTypes]);

  useEffect(() => {
    const filtered = TURKISH_CITIES.filter(city =>
      city.toLowerCase().includes(citySearch.toLowerCase())
    );
    setFilteredCities(filtered);
  }, [citySearch]);

  useEffect(() => {
    if (projectCity && DISTRICTS[projectCity]) {
      const filtered = DISTRICTS[projectCity].filter(district =>
        district.toLowerCase().includes(districtSearch.toLowerCase())
      );
      setFilteredDistricts(filtered);
    } else {
      setFilteredDistricts([]);
    }
  }, [projectCity, districtSearch]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      if (data) {
        setCompanies(data);
        setFilteredCompanies(data);
      }
    } catch (error) {
      console.error('Firma yükleme hatası:', error);
    }
  };

  const loadData = async (companyId: string) => {
    try {
      const [projectsRes, projectManagersRes, managersRes, typesRes] = await Promise.all([
        supabase
          .from('projects_greenco')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('project_managers')
          .select('project_id, manager_id'),
        supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('role', 'project_manager')
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('personnel_types')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
      ]);

      if (projectsRes.data) {
        const projectsWithManager = projectsRes.data.map((p: any) => {
          const projectManager = projectManagersRes.data?.find((pm: any) => pm.project_id === p.id);
          return {
            id: p.id,
            name: p.name,
            project_manager_id: projectManager?.manager_id || null
          };
        });
        setProjects(projectsWithManager);
        setFilteredProjects(projectsWithManager);
      }
      if (managersRes.data) {
        setManagers(managersRes.data);
        setFilteredManagers(managersRes.data);
      }
      if (typesRes.data) {
        setPersonnelTypes(typesRes.data);
        setFilteredPersonnelTypes(typesRes.data);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompany(companyId);
    loadData(companyId);

    if (mode === 'request') {
      // Talep oluşturma modunda direkt form sayfasına geç ve mevcut projeleri göster
      handleProjectTypeSelect(false);
    } else {
      setStep('project-type');
    }
  };

  const handleProjectTypeSelect = (isNew: boolean) => {
    setIsNewProject(isNew);
    setStep('form');

    setSelectedProject('');
    setProjectName('');
    setProjectStartDate('');
    setProjectEndDate('');
    setSelectedManager('');
    setIsNewManager(false);
    setManagerFullName('');
    setManagerPhone('');
    setManagerPassword('');
    setPositions([{ type: '', count: '', criminal_record: 'yok', certificates: '', isEditing: true }]);
  };

  const handleExistingProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    const project = projects.find(p => p.id === projectId);

    if (project) {
      setProjectName(project.name);
      if (project.project_manager_id) {
        setSelectedManager(project.project_manager_id);
        setIsNewManager(false);
      }
      loadExistingProjectData(projectId);
    }
  };

  const loadExistingProjectData = async (projectId: string) => {
    try {
      const [projectRes, requestRes] = await Promise.all([
        supabase
          .from('projects_greenco')
          .select('start_date, end_date')
          .eq('id', projectId)
          .maybeSingle(),
        supabase
          .from('personnel_requests')
          .select('personnel_positions, project_start_date, project_end_date')
          .eq('project_id', projectId)
          .in('status', ['approved', 'completed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (projectRes.data) {
        setProjectStartDate(projectRes.data.start_date || '');
        setProjectEndDate(projectRes.data.end_date || '');
      }

      if (requestRes.data) {
        if (requestRes.data.project_start_date) {
          setProjectStartDate(requestRes.data.project_start_date);
        }
        if (requestRes.data.project_end_date) {
          setProjectEndDate(requestRes.data.project_end_date);
        }

        if (requestRes.data.personnel_positions && Array.isArray(requestRes.data.personnel_positions)) {
          const currentPositions = requestRes.data.personnel_positions.map((p: any) => ({
            type: p.personnel_type_id || '',
            count: String(p.count || ''),
            criminal_record: p.criminal_record || 'yok',
            certificates: Array.isArray(p.certificates) ? p.certificates.join(', ') : '',
            isEditing: false
          }));

          if (currentPositions.length > 0) {
            setPositions(currentPositions);
          }
        }
      }
    } catch (error) {
      console.error('Mevcut proje verisi yükleme hatası:', error);
    }
  };

  const addPosition = () => {
    setPositions([...positions, { type: '', count: '', criminal_record: 'yok', certificates: '', isEditing: true }]);
  };

  const togglePositionEdit = (index: number) => {
    const updated = [...positions];
    updated[index].isEditing = !updated[index].isEditing;
    setPositions(updated);
  };

  const handleAddNewType = async () => {
    if (!newTypeName.trim()) {
      alert('Lütfen meslek türü adını girin');
      return;
    }

    setAddingNewType(true);
    try {
      const { data, error } = await supabase
        .from('personnel_types')
        .insert({ name: newTypeName.trim(), created_by: profile?.id })
        .select()
        .single();

      if (error) throw error;

      setPersonnelTypes([...personnelTypes, { id: data.id, name: data.name }]);
      setNewTypeName('');
      setShowNewTypeModal(false);
      alert('Yeni meslek türü başarıyla eklendi!');
    } catch (error: any) {
      console.error('Yeni tür ekleme hatası:', error);
      alert('Hata: ' + (error.message || 'Meslek türü eklenemedi'));
    } finally {
      setAddingNewType(false);
    }
  };

  const removePosition = (index: number) => {
    if (positions.length > 1) {
      setPositions(positions.filter((_, i) => i !== index));
    }
  };

  const updatePosition = (index: number, field: keyof PersonnelPosition, value: string | boolean) => {
    const updated = [...positions];
    if (field === 'isEditing') {
      updated[index][field] = value as boolean;
    } else {
      updated[index][field] = value as string;
    }
    setPositions(updated);
  };

  const handleSubmit = async () => {
    if (!selectedCompany) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen bir firma seçin');
      }
      return;
    }

    if (!projectName) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen proje adını girin veya mevcut projelerden birini seçin');
      }
      return;
    }

    if (isNewProject) {
      const existingProject = projects.find(p => p.name.toLowerCase().trim() === projectName.toLowerCase().trim());
      if (existingProject) {
        if (Platform.OS === 'web') {
          window.alert('Bu isimde bir proje zaten mevcut. Lütfen farklı bir isim girin veya mevcut projeyi seçin.');
        }
        return;
      }
    }

    if (!isNewProject && !selectedProject) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen bir proje seçin');
      }
      return;
    }

    if (!projectStartDate || !projectEndDate) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen proje tarihlerini doldurun');
      }
      return;
    }

    if (!isNewProject && selectedProject) {
      const project = projects.find(p => p.id === selectedProject);
      if (!project?.project_manager_id && !selectedManager && !isNewManager) {
        if (Platform.OS === 'web') {
          window.alert('Lütfen bir proje yöneticisi seçin veya yeni profil oluşturun');
        }
        return;
      }
    } else if (isNewProject) {
      if (!isNewManager && !selectedManager) {
        if (Platform.OS === 'web') {
          window.alert('Lütfen bir proje yöneticisi seçin veya yeni profil oluşturun');
        }
        return;
      }
    }

    if (isNewManager && (!managerFullName || !managerPhone || !managerPassword)) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen yeni proje yöneticisi bilgilerini doldurun');
      }
      return;
    }

    if (isNewProject && (!projectCity || !projectDistrict)) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen yeni proje için il ve ilçe bilgilerini doldurun');
      }
      return;
    }

    const emptyPosition = positions.find(p => !p.type || !p.count || parseInt(p.count) <= 0);
    if (emptyPosition) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen tüm personel pozisyonları için meslek türü ve adet bilgilerini doldurun');
      }
      return;
    }

    setLoading(true);
    try {
      let previousPositions: any[] = [];
      if (!isNewProject && selectedProject) {
        const { data: prevRequest } = await supabase
          .from('personnel_requests')
          .select('personnel_positions')
          .eq('project_id', selectedProject)
          .in('status', ['approved', 'completed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevRequest?.personnel_positions) {
          previousPositions = prevRequest.personnel_positions;
        }
      }

      const personnelPositionsData = positions.map(p => {
        const positionData: any = {
          personnel_type_id: p.type,
          count: parseInt(p.count),
          criminal_record: p.criminal_record,
          certificates: p.certificates ? p.certificates.split(',').map(c => c.trim()).filter(Boolean) : []
        };

        if (!isNewProject && previousPositions.length > 0) {
          const prevPosition = previousPositions.find((prev: any) => prev.personnel_type_id === p.type);
          if (prevPosition) {
            positionData.is_change_request = prevPosition.count !== parseInt(p.count);
          } else {
            positionData.is_change_request = true;
          }
        } else {
          positionData.is_change_request = false;
        }

        return positionData;
      });

      let finalProjectId = selectedProject;
      let finalManagerId = selectedManager;

      if (isNewManager) {
        if (!session?.session) throw new Error('Oturum bulunamadı');

        // Telefon numarasını formatla (+90...)
        let formattedPhone = managerPhone.replace(/\s+/g, ''); // Boşlukları temizle
        if (formattedPhone.startsWith('0')) {
          formattedPhone = formattedPhone.substring(1);
        }
        if (!formattedPhone.startsWith('+90')) {
          formattedPhone = '+90' + formattedPhone;
        }

        const apiUrl = 'https://mtfqfzilbyyxwjfuhkdf.supabase.co/functions/v1/create-user';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: formattedPhone,
            password: managerPassword,
            full_name: managerFullName,
            role: 'project_manager',
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error('Yönetici hesabı oluşturulamadı: ' + (result.error || 'Bilinmeyen hata'));
        }

        finalManagerId = result.user_id;
      }

      if (isNewProject) {
        const { data: projectData, error: projectError } = await supabase
          .from('projects_greenco')
          .insert({
            name: projectName,
            company_id: selectedCompany,
            start_date: projectStartDate,
            end_date: projectEndDate,
            city: projectCity,
            district: projectDistrict,
            is_active: true,
          })
          .select()
          .single();

        if (projectError) throw new Error('Proje oluşturulamadı: ' + projectError.message);
        finalProjectId = projectData.id;
      }

      if (finalManagerId && finalProjectId) {
        // 1. Proje Yöneticisi olarak ata (Yetki için)
        const { data: existingPM } = await supabase
          .from('project_managers')
          .select('id')
          .eq('project_id', finalProjectId)
          .eq('manager_id', finalManagerId)
          .maybeSingle();

        if (!existingPM) {
          const { error: pmError } = await supabase
            .from('project_managers')
            .insert({
              project_id: finalProjectId,
              manager_id: finalManagerId,
            });

          if (pmError) throw new Error('Proje yöneticisi atanamadı: ' + pmError.message);
        }

        // 2. Proje Personeli olarak da ata (Listelerde görünmesi için)
        const { data: existingAssignment } = await supabase
          .from('project_assignments')
          .select('id')
          .eq('project_id', finalProjectId)
          .eq('personnel_id', finalManagerId)
          .is('removed_at', null)
          .maybeSingle();

        if (!existingAssignment) {
          const { error: assignError } = await supabase
            .from('project_assignments')
            .insert({
              project_id: finalProjectId,
              personnel_id: finalManagerId,
              assigned_at: new Date().toISOString(),
            });

          if (assignError) {
            console.error('Yönetici personel listesine eklenemedi:', assignError);
            // Kritik hata fırlatmıyoruz, akış devam etsin
          }
        }

        // 3. Proje Yöneticisinin Company ID'sini güncelle
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ company_id: selectedCompany })
          .eq('id', finalManagerId);

        if (profileUpdateError) {
          console.error('Yönetici firma bilgisi güncellenemedi:', profileUpdateError);
        }
      }

      const { data, error } = await supabase.from('personnel_requests').insert({
        project_id: finalProjectId,
        project_name: projectName,
        project_start_date: projectStartDate,
        project_end_date: projectEndDate,
        is_new_project: false,
        city: isNewProject ? projectCity : null,
        district: isNewProject ? projectDistrict : null,
        project_manager_id: finalManagerId,
        is_new_manager: false,
        manager_data: null,
        personnel_positions: personnelPositionsData,
        requested_by: profile?.id,
        notes: notes || null,
        status: 'awaiting_assignment',
      })
        .select()
        .single();

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Başarılı! Personel talebi oluşturuldu, şimdi atama yapabilirsiniz.');
      }
      router.push(`/admin/assign-personnel?requestId=${data.id}`);
    } catch (error: any) {
      console.error('Proje oluşturma hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Proje oluşturulamadı'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'company') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Firma Seçin</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>HANGİ FİRMA İÇİN?</Text>

          {companies.length === 0 ? (
            <Text style={styles.emptyText}>Henüz firma yok</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Firma ara..."
                value={companySearch}
                onChangeText={setCompanySearch}
              />
              <ScrollView style={styles.projectScrollView}>
                <View style={styles.selectContainer}>
                  {filteredCompanies.map((company) => (
                    <TouchableOpacity
                      key={company.id}
                      style={styles.selectItem}
                      onPress={() => handleCompanySelect(company.id)}
                    >
                      <Text style={styles.selectItemText}>{company.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'project-type') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('company')}>
            <ArrowLeft size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Proje Tipi Seçin</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.centerContent}>
          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => handleProjectTypeSelect(false)}
          >
            <Text style={styles.typeTitle}>Mevcut Proje</Text>
            <Text style={styles.typeDescription}>
              Var olan bir projeye personel talebi oluştur
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => handleProjectTypeSelect(true)}
          >
            <Text style={styles.typeTitle}>Yeni Proje</Text>
            <Text style={styles.typeDescription}>
              Yeni bir proje oluştur ve personel talebi yap
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Modal visible={showNewTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Meslek Türü Ekle</Text>
            <TextInput
              style={styles.input}
              placeholder="Meslek türü adı (Örn: Komi)"
              value={newTypeName}
              onChangeText={setNewTypeName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNewTypeModal(false);
                  setNewTypeName('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, addingNewType && { opacity: 0.5 }]}
                onPress={handleAddNewType}
                disabled={addingNewType}
              >
                <Text style={styles.modalButtonTextConfirm}>
                  {addingNewType ? 'Ekleniyor...' : 'Ekle'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('project-type')}>
            <ArrowLeft size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title || 'Yeni Proje Oluştur'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <View style={styles.companyInfoCard}>
                <View style={styles.companyInfoLeft}>
                  <View style={styles.companyIconBox}>
                    <Building2 size={24} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.companyInfoLabel}>Seçili Firma</Text>
                    <Text style={styles.companyInfoName}>
                      {companies.find(c => c.id === selectedCompany)?.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.changeCompanyBtn}
                  onPress={() => setStep('company')}
                >
                  <Pencil size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.changeCompanyText}>Değiştir</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>PROJE BİLGİLERİ</Text>

              {!isNewProject ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Proje <Text style={styles.required}>*</Text></Text>
                  {projects.length === 0 ? (
                    <Text style={styles.emptyText}>Henüz proje yok</Text>
                  ) : selectedProject ? (
                    <View style={styles.selectedContainer}>
                      <Text style={styles.selectedValue}>
                        {projects.find(p => p.id === selectedProject)?.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedProject('');
                          setProjectName('');
                          setProjectStartDate('');
                          setProjectEndDate('');
                          setPositions([{ type: '', count: '', criminal_record: 'yok', certificates: '' }]);
                        }}
                        style={styles.clearButton}
                      >
                        <Text style={styles.clearButtonText}>Değiştir</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Proje ara..."
                        value={projectSearch}
                        onChangeText={setProjectSearch}
                      />
                      <ScrollView style={styles.projectScrollView} nestedScrollEnabled>
                        <View style={styles.selectContainer}>
                          {filteredProjects.map((project) => (
                            <TouchableOpacity
                              key={project.id}
                              style={styles.selectItem}
                              onPress={() => {
                                handleExistingProjectSelect(project.id);
                                setProjectSearch('');
                              }}
                            >
                              <Text style={styles.selectItemText}>
                                {project.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.field}>
                  <Text style={styles.label}>Proje Adı <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Proje adını girin"
                    value={projectName}
                    onChangeText={setProjectName}
                  />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Başlangıç Tarihi <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD (Örn: 2025-12-01)"
                  value={projectStartDate}
                  onChangeText={setProjectStartDate}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Bitiş Tarihi <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD (Örn: 2026-06-30)"
                  value={projectEndDate}
                  onChangeText={setProjectEndDate}
                />
              </View>

              {!isNewProject && selectedProject && (
                <View style={styles.field}>
                  <Text style={styles.label}>Proje Yöneticisi {!projects.find(p => p.id === selectedProject)?.project_manager_id && <Text style={styles.required}>*</Text>}</Text>
                  {!isNewManager ? (
                    <>
                      {selectedManager || projects.find(p => p.id === selectedProject)?.project_manager_id ? (
                        <View style={styles.selectedContainer}>
                          <Text style={styles.selectedValue}>
                            {managers.find(m => m.id === (selectedManager || projects.find(p => p.id === selectedProject)?.project_manager_id))?.full_name || 'Atanmış'}
                          </Text>
                          {!projects.find(p => p.id === selectedProject)?.project_manager_id && (
                            <TouchableOpacity
                              onPress={() => setSelectedManager('')}
                              style={styles.clearButton}
                            >
                              <Text style={styles.clearButtonText}>Değiştir</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <>
                          <TextInput
                            style={styles.input}
                            placeholder="Proje yöneticisi ara..."
                            value={managerSearch}
                            onChangeText={setManagerSearch}
                          />
                          <ScrollView style={styles.projectScrollView} nestedScrollEnabled>
                            <View style={styles.selectContainer}>
                              {filteredManagers.map((manager) => (
                                <TouchableOpacity
                                  key={manager.id}
                                  style={styles.selectItem}
                                  onPress={() => {
                                    setSelectedManager(manager.id);
                                    setManagerSearch('');
                                  }}
                                >
                                  <Text style={styles.selectItemText}>
                                    {manager.full_name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                        </>
                      )}
                      {!projects.find(p => p.id === selectedProject)?.project_manager_id && (
                        <TouchableOpacity
                          style={styles.newProfileButton}
                          onPress={() => setIsNewManager(true)}
                        >
                          <Plus size={16} color={COLORS.primary} />
                          <Text style={styles.newProfileText}>Yeni Profil Oluştur</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <View style={styles.newManagerSection}>
                      <TextInput
                        style={styles.input}
                        placeholder="Ad Soyad"
                        value={managerFullName}
                        onChangeText={setManagerFullName}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Telefon (+905551234567)"
                        value={managerPhone}
                        onChangeText={setManagerPhone}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Şifre"
                        secureTextEntry
                        value={managerPassword}
                        onChangeText={setManagerPassword}
                      />
                      <TouchableOpacity
                        style={styles.cancelNewProfile}
                        onPress={() => {
                          setIsNewManager(false);
                          setManagerFullName('');
                          setManagerPhone('');
                          setManagerPassword('');
                        }}
                      >
                        <Text style={styles.cancelText}>İptal</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {isNewProject && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>İl <Text style={styles.required}>*</Text></Text>
                    {projectCity ? (
                      <View style={styles.selectedContainer}>
                        <Text style={styles.selectedValue}>{projectCity}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setProjectCity('');
                            setProjectDistrict('');
                          }}
                          style={styles.clearButton}
                        >
                          <Text style={styles.clearButtonText}>Değiştir</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="İl ara..."
                          value={citySearch}
                          onChangeText={setCitySearch}
                        />
                        <ScrollView style={styles.typeScrollView} nestedScrollEnabled>
                          <View style={styles.selectContainer}>
                            {filteredCities.map((city) => (
                              <TouchableOpacity
                                key={city}
                                style={styles.selectItem}
                                onPress={() => {
                                  setProjectCity(city);
                                  setProjectDistrict('');
                                  setCitySearch('');
                                }}
                              >
                                <Text style={styles.selectItemText}>{city}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </>
                    )}
                  </View>

                  {projectCity && (
                    <View style={styles.field}>
                      <Text style={styles.label}>İlçe <Text style={styles.required}>*</Text></Text>
                      {projectDistrict ? (
                        <View style={styles.selectedContainer}>
                          <Text style={styles.selectedValue}>{projectDistrict}</Text>
                          <TouchableOpacity
                            onPress={() => setProjectDistrict('')}
                            style={styles.clearButton}
                          >
                            <Text style={styles.clearButtonText}>Değiştir</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <TextInput
                            style={styles.input}
                            placeholder="İlçe ara..."
                            value={districtSearch}
                            onChangeText={setDistrictSearch}
                          />
                          <ScrollView style={styles.typeScrollView} nestedScrollEnabled>
                            <View style={styles.selectContainer}>
                              {filteredDistricts.map((district) => (
                                <TouchableOpacity
                                  key={district}
                                  style={styles.selectItem}
                                  onPress={() => {
                                    setProjectDistrict(district);
                                    setDistrictSearch('');
                                  }}
                                >
                                  <Text style={styles.selectItemText}>{district}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                        </>
                      )}
                    </View>
                  )}
                </>
              )}

              {isNewProject && (
                <View style={styles.field}>
                  <Text style={styles.label}>Proje Yöneticisi <Text style={styles.required}>*</Text></Text>
                  {!isNewManager ? (
                    <>
                      {managers.length > 0 ? (
                        selectedManager ? (
                          <View style={styles.selectedContainer}>
                            <Text style={styles.selectedValue}>
                              {managers.find(m => m.id === selectedManager)?.full_name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => setSelectedManager('')}
                              style={styles.clearButton}
                            >
                              <Text style={styles.clearButtonText}>Değiştir</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <TextInput
                              style={styles.input}
                              placeholder="Proje yöneticisi ara..."
                              value={managerSearch}
                              onChangeText={setManagerSearch}
                            />
                            <ScrollView style={styles.projectScrollView} nestedScrollEnabled>
                              <View style={styles.selectContainer}>
                                {filteredManagers.map((manager) => (
                                  <TouchableOpacity
                                    key={manager.id}
                                    style={styles.selectItem}
                                    onPress={() => {
                                      setSelectedManager(manager.id);
                                      setManagerSearch('');
                                    }}
                                  >
                                    <Text style={styles.selectItemText}>
                                      {manager.full_name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </ScrollView>
                          </>
                        )
                      ) : (
                        <Text style={styles.emptyText}>Henüz proje yöneticisi yok</Text>
                      )}
                      <TouchableOpacity
                        style={styles.newProfileButton}
                        onPress={() => setIsNewManager(true)}
                      >
                        <Plus size={16} color={COLORS.primary} />
                        <Text style={styles.newProfileText}>Yeni Profil Oluştur</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.newManagerSection}>
                      <TextInput
                        style={styles.input}
                        placeholder="Ad Soyad"
                        value={managerFullName}
                        onChangeText={setManagerFullName}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Telefon (+905551234567)"
                        value={managerPhone}
                        onChangeText={setManagerPhone}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Şifre"
                        secureTextEntry
                        value={managerPassword}
                        onChangeText={setManagerPassword}
                      />
                      <TouchableOpacity
                        style={styles.cancelNewProfile}
                        onPress={() => {
                          setIsNewManager(false);
                          setManagerFullName('');
                          setManagerPhone('');
                          setManagerPassword('');
                        }}
                      >
                        <Text style={styles.cancelText}>İptal</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TALEP EDİLEN PERSONEL</Text>

              {positions.map((position, index) => {
                const selectedType = personnelTypes.find(t => t.id === position.type);
                const headerTitle = !isNewProject && selectedType && position.count
                  ? `Mevcut Personel #${index + 1}: ${position.count} ${selectedType.name}`
                  : `Personel #${index + 1}`;

                return (
                  <View key={index} style={styles.positionCard}>
                    <View style={styles.positionHeader}>
                      <View style={styles.positionHeaderLeft}>
                        <Text style={styles.positionTitle}>{headerTitle}</Text>
                        {!isNewProject && selectedType && position.isEditing !== true && (
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => togglePositionEdit(index)}
                          >
                            <Text style={styles.editButtonText}>Değiştir</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {positions.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removePosition(index)}
                        >
                          <Text style={styles.removeButtonText}>Kaldır</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {(isNewProject || position.isEditing === true) && (
                      <>
                        <View style={styles.field}>
                          <Text style={styles.label}>Meslek Türü <Text style={styles.required}>*</Text></Text>
                          {position.type ? (
                            <View style={styles.selectedContainer}>
                              <Text style={styles.selectedValue}>
                                {personnelTypes.find(t => t.id === position.type)?.name}
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  updatePosition(index, 'type', '');
                                  setPersonnelTypeSearch('');
                                }}
                                style={styles.clearButton}
                              >
                                <Text style={styles.clearButtonText}>Değiştir</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <>
                              <TextInput
                                style={styles.input}
                                placeholder="Meslek ara..."
                                value={personnelTypeSearch}
                                onChangeText={setPersonnelTypeSearch}
                              />
                              <ScrollView style={styles.typeScrollView} nestedScrollEnabled>
                                <View style={styles.selectContainer}>
                                  {filteredPersonnelTypes.map((type) => (
                                    <TouchableOpacity
                                      key={type.id}
                                      style={styles.selectItem}
                                      onPress={() => {
                                        updatePosition(index, 'type', type.id);
                                        setPersonnelTypeSearch('');
                                      }}
                                    >
                                      <Text style={styles.selectItemText}>
                                        {type.name}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </ScrollView>
                              <TouchableOpacity
                                style={styles.newProfileButton}
                                onPress={() => setShowNewTypeModal(true)}
                              >
                                <Plus size={16} color={COLORS.primary} />
                                <Text style={styles.newProfileText}>Yeni Meslek Türü Ekle</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>

                        <View style={styles.field}>
                          <Text style={styles.label}>Personel Adedi <Text style={styles.required}>*</Text></Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Örn: 5"
                            keyboardType="numeric"
                            value={position.count}
                            onChangeText={(value) => updatePosition(index, 'count', value)}
                          />
                        </View>

                        <View style={styles.field}>
                          <Text style={styles.label}>Sabıka Kaydı</Text>
                          <View style={styles.selectContainer}>
                            {CRIMINAL_RECORD_OPTIONS.map((option) => (
                              <TouchableOpacity
                                key={option}
                                style={[
                                  styles.selectItem,
                                  position.criminal_record === option && styles.selectItemActive,
                                ]}
                                onPress={() => updatePosition(index, 'criminal_record', option)}
                              >
                                <Text
                                  style={[
                                    styles.selectItemText,
                                    position.criminal_record === option && styles.selectItemTextActive,
                                  ]}
                                >
                                  Sabıka Kaydı {option.toUpperCase()}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <View style={styles.field}>
                          <Text style={styles.label}>Talep Edilen Sertifikalar</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Virgülle ayırın (Örn: İş Güvenliği, Forklift)"
                            value={position.certificates}
                            onChangeText={(value) => updatePosition(index, 'certificates', value)}
                          />
                        </View>
                      </>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity style={styles.addPositionButton} onPress={addPosition}>
                <Plus size={20} color={COLORS.primary} />
                <Text style={styles.addPositionText}>Personel Ekle</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Notlar (İsteğe bağlı)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Ek açıklamalar..."
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <CheckCircle size={20} color="white" />
              <Text style={styles.submitButtonText}>
                {loading ? 'İşleniyor...' : (mode === 'request' ? 'Talep Oluştur' : 'Projeyi Oluştur')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
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
  centerContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 16,
  },
  typeCard: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  typeDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  required: {
    color: COLORS.danger,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selectContainer: {
    gap: 8,
  },
  selectItem: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  selectItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  selectItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  selectItemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  projectScrollView: {
    maxHeight: 200,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    padding: 20,
  },
  newProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 8,
  },
  newProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  newManagerSection: {
    gap: 12,
  },
  cancelNewProfile: {
    padding: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  positionCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  positionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  editButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: COLORS.primary + '15',
  },
  editButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  companyInfoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  companyInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyInfoLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  companyInfoName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  changeCompanyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeCompanyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.danger + '15',
  },
  removeButtonText: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
  },
  addPositionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addPositionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 10,
    marginTop: 10,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  typeScrollView: {
    maxHeight: 200,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryLight,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  selectedValue: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  clearButtonText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonConfirm: {
    backgroundColor: COLORS.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
