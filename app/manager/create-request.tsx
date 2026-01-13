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
import { ArrowLeft, Plus, Trash2, Send, X } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

export default function CreateRequestScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { editId, projectId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [step, setStep] = useState<'project-type' | 'form'>('project-type');
  const [isNewProject, setIsNewProject] = useState(false);

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

  // Team & Title additions
  type ProjectTeam = {
    id: string;
    name: string;
  };

  const [requestTitle, setRequestTitle] = useState('');
  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const loadExistingRequest = async () => {
    if (!editId || !projectId) return;

    try {
      setLoading(true);

      const { data: request, error } = await supabase
        .from('personnel_requests')
        .select(`
          *,
          personnel_positions
        `)
        .eq('id', editId)
        .maybeSingle();

      if (error) throw error;
      if (!request) return;

      const { data: project } = await supabase
        .from('projects_greenco')
        .select('name, start_date, end_date')
        .eq('id', projectId)
        .maybeSingle();

      setSelectedProject(projectId as string);
      setProjectName(project?.name || '');
      setProjectStartDate(request.project_start_date || project?.start_date || '');
      setProjectEndDate(request.project_end_date || project?.end_date || '');
      setProjectCity(request.city || '');
      setProjectDistrict(request.district || '');

      const loadedPositions = request.personnel_positions.map((pos: any) => ({
        type: pos.personnel_type_id || '',
        count: String(pos.count || pos.quantity || ''),
        criminal_record: pos.criminal_record || 'yok',
        certificates: Array.isArray(pos.certificates) ? pos.certificates.join(', ') : (pos.certificates || ''),
        isEditing: false
      }));

      setPositions(loadedPositions);
      setNotes(request.notes || '');

      // Load teams if projectId exists
      if (projectId) {
        await loadTeams(projectId as string);
      }
      if (request.title) setRequestTitle(request.title);
      if (request.team_id) setSelectedTeamId(request.team_id);

    } catch (error) {
      console.error('Talep yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Edit mode'da başlangıçta step'i form yap
    if (editId && projectId) {
      setStep('form');
      setIsEditMode(true);
    }
  }, [editId, projectId]);

  useEffect(() => {
    if (editId && projectId && personnelTypes.length > 0) {
      loadExistingRequest();
    }
  }, [editId, projectId, personnelTypes]);

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

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [managedProjectsRes, projectsRes, projectManagersRes, managersRes, typesRes] = await Promise.all([
        supabase
          .from('project_managers')
          .select('project_id')
          .eq('manager_id', user.id),
        supabase
          .from('projects_greenco')
          .select('id, name')
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

      const managedProjectIds = managedProjectsRes.data?.map(pm => pm.project_id) || [];

      if (projectsRes.data && managedProjectIds.length > 0) {
        const managedProjects = projectsRes.data.filter(p => managedProjectIds.includes(p.id));

        const projectsWithManager = managedProjects.map((p: any) => {
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
      loadTeams(projectId);
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

  const loadTeams = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_teams')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
    }
  };

  const handleDeleteTeam = (teamId: string) => {
    if (isNewProject) {
      setTeams(prev => prev.filter(t => t.id !== teamId));
      if (selectedTeamId === teamId) {
        setSelectedTeamId('');
      }
    } else {
      if (teamId.startsWith('temp-')) {
        setTeams(prev => prev.filter(t => t.id !== teamId));
      } else {
        supabase
          .from('project_teams')
          .delete()
          .eq('id', teamId)
          .then(({ error }) => {
            if (error) {
              console.error('Error deleting team:', error);
              alert('Ekip silinirken hata oluştu.');
            } else {
              setTeams(prev => prev.filter(t => t.id !== teamId));
              if (selectedTeamId === teamId) setSelectedTeamId('');
            }
          });
      }
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      alert('Lütfen bir ekip adı girin');
      return;
    }

    try {
      // If it's a new project, just add to local state
      if (isNewProject) {
        const tempId = `temp-${Date.now()}`;
        setTeams([...teams, { id: tempId, name: newTeamName.trim() }]);
        setSelectedTeamId(tempId);
        setNewTeamName('');
        setShowCreateTeamModal(false);
        return;
      }

      setCreatingTeam(true);

      // If existing project, save to DB
      if (!selectedProject) {
        alert('Lütfen önce bir proje seçin');
        return;
      }

      const { data, error } = await supabase
        .from('project_teams')
        .insert({
          project_id: selectedProject,
          name: newTeamName.trim(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setTeams([...teams, { id: data.id, name: data.name }]);
      setSelectedTeamId(data.id);
      setNewTeamName('');
      setShowCreateTeamModal(false);
      if (Platform.OS === 'web') {
        window.alert('Yeni ekip oluşturuldu');
      }
    } catch (error: any) {
      console.error('Error creating team:', error);
      alert('Ekip oluşturulurken bir hata oluştu');
    } finally {
      setCreatingTeam(false);
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

      if (project?.project_manager_id) {
        // OK
      } else if (selectedManager) {
        // OK
      } else if (isNewManager) {
        // OK
      } else {
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

    if (!requestTitle.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen talep başlığını girin');
      }
      return;
    }

    if (!isNewProject && !selectedTeamId) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen bir ekip seçin veya yeni ekip oluşturun');
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

      const managerData = isNewManager ? {
        full_name: managerFullName,
        phone: managerPhone,
        password: managerPassword
      } : null;

      if (isEditMode && editId) {
        const { error } = await supabase
          .from('personnel_requests')
          .update({
            project_start_date: projectStartDate,
            project_end_date: projectEndDate,
            city: projectCity || null,
            district: projectDistrict || null,
            personnel_positions: personnelPositionsData,
            notes: notes || null,
            updated_at: new Date().toISOString(),
            title: requestTitle || null,
            team_id: selectedTeamId || null,
          })
          .eq('id', editId);

        if (error) throw error;

        if (Platform.OS === 'web') {
          window.alert('Başarılı! Talebiniz güncellendi.');
        }

        // Geri döndüğünde güncel veriyi görsün diye router.back() kullan
        router.back();
      } else {
        // Determine team parameters
        let finalTeamId: string | null = selectedTeamId;
        let newTeamName: string | null = null;

        if (isNewProject && selectedTeamId?.startsWith('temp-')) {
          // If it's a new project and a temp team is selected, DO NOT create it in DB yet.
          // Instead, save the name to new_team_name column in request.
          finalTeamId = null;
          newTeamName = teams.find(t => t.id === selectedTeamId)?.name || null;
        }

        const { error } = await supabase.from('personnel_requests').insert({
          project_id: isNewProject ? null : selectedProject || null,
          project_name: projectName,
          project_start_date: projectStartDate,
          project_end_date: projectEndDate,
          is_new_project: isNewProject,
          city: isNewProject ? projectCity : null,
          district: isNewProject ? projectDistrict : null,
          project_manager_id: isNewManager ? null : selectedManager || null,
          is_new_manager: isNewManager,
          manager_data: managerData,
          personnel_positions: personnelPositionsData,
          requested_by: profile?.id,
          notes: notes || null,
          status: 'pending',
          title: requestTitle || null,
          team_id: finalTeamId || null,
          new_team_name: newTeamName // Store proposed team name for admin approval
        } as any); // Type assertion for new column

        if (error) throw error;

        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .eq('is_active', true);

        if (admins && admins.length > 0) {
          const notifications = admins.map(admin => ({
            user_id: admin.id,
            title: 'Yeni Personel Talebi',
            message: `${projectName} projesi için yeni personel talebi oluşturuldu.`,
            type: 'system',
          }));
          await supabase.from('notifications').insert(notifications);
        }

        if (Platform.OS === 'web') {
          window.alert('Başarılı! Talebiniz oluşturuldu ve yöneticilere bildirim gönderildi.');
        }
      }
      router.back();
    } catch (error: any) {
      console.error('Talep oluşturma hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Talep oluşturulamadı'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'project-type') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
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


      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('project-type')}>
            <ArrowLeft size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personel Talebi Oluştur</Text>
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
              <Text style={styles.sectionTitle}>TALEP DETAYLARI</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Talep Başlığı <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: Gündüz Vardiyası, Kar Temizleme vb."
                  value={requestTitle}
                  onChangeText={setRequestTitle}
                />
              </View>

              <View style={styles.field}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.label}>Ekip {isNewProject && '(Opsiyonel)'}</Text>
                  <TouchableOpacity onPress={() => setShowCreateTeamModal(true)}>
                    <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '600' }}>+ Yeni Ekip</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {teams.map(team => (
                      <View key={team.id} style={{ position: 'relative' }}>
                        <TouchableOpacity
                          style={[
                            styles.typeCard, // Reusing style but smaller
                            {
                              padding: 12,
                              minWidth: 100,
                              backgroundColor: selectedTeamId === team.id ? '#e0f2fe' : 'white',
                              borderColor: selectedTeamId === team.id ? COLORS.primary : COLORS.border,
                              borderWidth: 1.5,
                              paddingRight: 28 // Make room for delete button
                            }
                          ]}
                          onPress={() => setSelectedTeamId(team.id)}
                        >
                          <Text style={[
                            { fontSize: 14, fontWeight: '600', textAlign: 'center' },
                            selectedTeamId === team.id ? { color: COLORS.primary } : { color: COLORS.text }
                          ]}>
                            {team.name}
                          </Text>
                        </TouchableOpacity>

                        {(isNewProject || team.id.startsWith('temp-') || true) && (
                          <TouchableOpacity
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              padding: 4,
                              zIndex: 10
                            }}
                            onPress={() => handleDeleteTeam(team.id)}
                          >
                            <X size={14} color={COLORS.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    {teams.length === 0 && (
                      <Text style={{ color: COLORS.textLight, fontStyle: 'italic', padding: 8 }}>
                        Henüz ekip oluşturulmamış
                      </Text>
                    )}
                  </View>
                </ScrollView>
              </View>
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
                                  style={[
                                    styles.selectItem,
                                    position.type === type.id && styles.selectItemActive,
                                  ]}
                                  onPress={() => {
                                    updatePosition(index, 'type', type.id);
                                    setPersonnelTypeSearch('');
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.selectItemText,
                                      position.type === type.id && styles.selectItemTextActive,
                                    ]}
                                  >
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
              <Send size={20} color="white" />
              <Text style={styles.submitButtonText}>
                {loading ? 'Gönderiliyor...' : 'Talebi Gönder'}
              </Text>
            </TouchableOpacity>
          </ScrollView >
        </KeyboardAvoidingView >

        {showCreateTeamModal && (
          <View style={[styles.modalOverlay, { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 9999, elevation: 5 }]}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Yeni Ekip Oluştur</Text>
              <Text style={{ marginBottom: 12, color: COLORS.textLight, fontSize: 13 }}>
                Projedeki personelleri gruplamak için bir ekip adı girin (Örn: Elektrik Ekibi, Tesisat Ekibi).
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ekip adı"
                value={newTeamName}
                onChangeText={setNewTeamName}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowCreateTeamModal(false);
                    setNewTeamName('');
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm, creatingTeam && { opacity: 0.5 }]}
                  onPress={handleCreateTeam}
                  disabled={creatingTeam}
                >
                  <Text style={styles.modalButtonTextConfirm}>
                    {creatingTeam ? 'Oluşturuluyor...' : 'Oluştur'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView >
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
