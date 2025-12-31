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
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Search, User, Pencil, Trash2, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { InputGroup } from '@/components/InputGroup';
import { PersonnelTypeSelector } from '@/components/PersonnelTypeSelector';
import { ServiceModuleSelector } from '@/components/ServiceModuleSelector';
import { TURKISH_CITIES, DISTRICTS } from '@/constants/locations';

type UserProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'personnel' | 'project_manager' | 'operations' | 'admin';
  company_id: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  company?: { name: string };
  city?: string | null;
  district?: string | null;
  tc_identity_no?: string | null;
  birth_date?: string | null;
  service_modules?: string[];
};

type Company = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  name: string;
  company_id?: string;
};

export default function UsersManagement() {
  console.log('UsersManagement component rendered');
  const router = useRouter();

  const showAlert = (title: string, message: string, buttons?: any[]) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 0) {
        // Simple confirm for web doesn't map 1:1 to Alert buttons, but we can approximate
        const confirmBtn = buttons.find(b => b.style !== 'cancel');
        if (confirmBtn && window.confirm(message)) {
          confirmBtn.onPress && confirmBtn.onPress();
        }
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    password: '',
    role: 'personnel' as 'personnel' | 'project_manager' | 'operations' | 'admin',
    company_id: '',
    project_ids: [] as string[],
    city: '',
    district: '',
    avatar_url: '',
    tc_identity_no: '',
    birth_date: '',
    personnel_type_ids: [] as string[],
    service_modules: [] as string[],
  });

  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [filteredCities, setFilteredCities] = useState<string[]>(TURKISH_CITIES);
  const [filteredDistricts, setFilteredDistricts] = useState<string[]>([]);


  useEffect(() => {
    console.log('Users Management: useEffect triggered');
    loadData();
  }, [currentPage]);

  useEffect(() => {
    const filtered = TURKISH_CITIES.filter(city =>
      city.toLowerCase().includes(citySearch.toLowerCase())
    );
    setFilteredCities(filtered);
  }, [citySearch]);

  useEffect(() => {
    if (formData.city && DISTRICTS[formData.city]) {
      const filtered = DISTRICTS[formData.city].filter(district =>
        district.toLowerCase().includes(districtSearch.toLowerCase())
      );
      setFilteredDistricts(filtered);
    } else {
      setFilteredDistricts([]);
    }
  }, [formData.city, districtSearch]);

  useEffect(() => {
    if (formData.company_id) {
      const filtered = allProjects.filter(p => (p as any).company_id === formData.company_id);
      setProjects(filtered);
      // Firma değiştiğinde seçili projeleri temizle, ancak mevcut ve geçerli olanları koru
      setFormData(prev => ({
        ...prev,
        project_ids: prev.project_ids.filter(id => filtered.some(p => p.id === id))
      }));
    } else {
      setProjects([]);
    }
  }, [formData.company_id, allProjects]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setCurrentPage(1);
    }
    loadData();
  }, [searchQuery]);

  useEffect(() => {
    filterUsers();
  }, [users]);


  const loadData = async () => {
    try {
      console.log('Users Management: Loading data...');
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session');
      }

      let query = supabase
        .from('profiles')
        .select('id, full_name, phone, role, company_id, is_active, avatar_url, created_at, city, district, tc_identity_no, birth_date, service_modules, company:companies(name, is_active, deleted_at)', { count: 'exact' })
        .is('technical_company_id', null)
        .neq('role', 'technical_company') // Teknisyen firmalarını bu listede gösterme
        .eq('is_active', true) // Sadece aktif kullanıcıları getir
        .order('created_at', { ascending: false });

      if (!searchQuery.trim()) {
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        query = query.range(from, to);
      }

      const { data: allUsers, error: usersError, count } = await query;

      if (usersError) throw usersError;

      const [companiesRes, projectsRes] = await Promise.all([
        supabase.from('companies').select('id, name, is_active, deleted_at')
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('is_tech_service_company', false),
        supabase.from('projects_greenco').select('id, name, company_id').eq('is_active', true).not('company_id', 'is', null).order('name'),
      ]);

      console.log('Users Management: Users loaded:', allUsers?.length, 'Total:', count);

      if (companiesRes.error) {
        console.error('Users Management: Error loading companies:', companiesRes.error);
      }

      // Kullanıcı listesi formatlama + Silinmiş firmaya ait kullanıcıları gizleme
      const formattedUsers = (allUsers || [])
        .map((user: any) => ({
          ...user,
          company: Array.isArray(user.company) ? user.company[0] : user.company
        }))
        .filter((user: any) => {
          // Eğer kullanıcının firması varsa ve o firma silinmişse/pasifse kullanıcıyı lisede gösterme
          if (user.company) {
            if (user.company.deleted_at || user.company.is_active === false) {
              return false;
            }
          }
          return true;
        });

      setUsers(formattedUsers);
      setTotalCount(count || 0);

      if (companiesRes.data) {
        // İstemci tarafında da sıkı filtreleme
        const validCompanies = companiesRes.data.filter((c: any) => {
          if (c.deleted_at) return false;
          if (c.is_active === false) return false;
          return true;
        });
        setCompanies(validCompanies);
      }
      if (projectsRes.data) setAllProjects(projectsRes.data);
    } catch (error) {
      console.error('Users Management: Exception:', error);
      showAlert('Hata', 'Veriler yüklenemedi');
    } finally {
      console.log('Users Management: Setting loading to false');
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone?.includes(searchQuery)
    );
    setFilteredUsers(filtered);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      showAlert('İzin Gerekli', 'Galeriye erişim için izin vermeniz gerekiyor');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const takePicture = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      showAlert('İzin Gerekli', 'Kameraya erişim için izin vermeniz gerekiyor');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileName = `${Date.now()}.jpg`;
      const filePath = `${session.user.id}/${fileName}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, avatar_url: publicUrl });
      showAlert('Başarılı', 'Resim yüklendi');
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Hata', 'Resim yüklenemedi');
    }
  };

  const openModal = async (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);

      let projectIds: string[] = [];
      if (user.role === 'project_manager') {
        const { data } = await supabase
          .from('project_managers')
          .select('project_id')
          .eq('manager_id', user.id);
        projectIds = data?.map(pm => pm.project_id) || [];
      }

      let personnelTypeIds: string[] = [];
      if (user.role === 'personnel') {
        const { data } = await supabase
          .from('profile_personnel_types')
          .select('personnel_type_id')
          .eq('profile_id', user.id);
        personnelTypeIds = data?.map(pt => pt.personnel_type_id) || [];
      }

      const serviceModules = user.service_modules || [];

      setFormData({
        full_name: user.full_name,
        phone: user.phone || '',
        password: '',
        role: user.role,
        company_id: user.company_id || '',
        project_ids: projectIds,
        city: user.city || '',
        district: user.district || '',
        avatar_url: user.avatar_url || '',
        tc_identity_no: user.tc_identity_no || '',
        birth_date: user.birth_date || '',
        personnel_type_ids: personnelTypeIds,
        service_modules: serviceModules,
      });
    } else {
      setEditingUser(null);
      setFormData({
        full_name: '',
        phone: '',
        password: '',
        role: 'personnel',
        company_id: '',
        project_ids: [],
        city: '',
        district: '',
        avatar_url: '',
        tc_identity_no: '',
        birth_date: '',
        personnel_type_ids: [],
        service_modules: [],
      });
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingUser(null);
  };

  const handleSave = async () => {
    console.log('handleSave called with formData:', formData);

    if (!formData.full_name || !formData.phone) {
      console.log('Validation failed: missing name or phone');
      showAlert('Hata', 'Ad Soyad ve Telefon zorunludur');
      return;
    }

    if (!editingUser && !formData.password) {
      console.log('Validation failed: missing password for new user');
      showAlert('Hata', 'Yeni kullanıcı için şifre zorunludur');
      return;
    }

    if (formData.role === 'project_manager') {
      if (!formData.company_id) {
        showAlert('Hata', 'Proje Yöneticisi için firma zorunludur');
        return;
      }
      if (formData.project_ids.length === 0) {
        showAlert('Hata', 'Proje Yöneticisi için en az bir proje seçilmelidir');
        return;
      }
    }

    if (formData.role === 'operations' && !formData.company_id) {
      showAlert('Hata', 'Operasyon Yöneticisi için firma zorunludur');
      return;
    }

    if (formData.role === 'personnel') {
      if (!formData.city) {
        showAlert('Hata', 'Personel için il seçimi zorunludur');
        return;
      }
      if (!formData.district) {
        showAlert('Hata', 'Personel için ilçe seçimi zorunludur');
        return;
      }
      if (!formData.tc_identity_no || formData.tc_identity_no.length !== 11) {
        showAlert('Hata', 'Personel için TC Kimlik No (11 haneli) zorunludur');
        return;
      }
      if (!formData.birth_date) {
        showAlert('Hata', 'Personel için doğum tarihi zorunludur');
        return;
      }

      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        showAlert('Hata', 'Personel 18 yaşından küçük olamaz.');
        return;
      }
      if (!formData.avatar_url) {
        showAlert('Hata', 'Personel için profil fotoğrafı zorunludur');
        return;
      }
      if (formData.personnel_type_ids.length === 0) {
        showAlert('Hata', 'Personel için en az bir meslek seçimi zorunludur');
        return;
      }
    }

    console.log('Validation passed, checking for duplicates...');

    // PRE-CHECK: Duplicate Validation
    if (!editingUser) {
      setLoading(true);
      const formattedPhone = formData.phone.startsWith('+') ? formData.phone : `+90${formData.phone}`;
      const email = `${formData.phone.replace('+', '')}@greenco.app`;

      // 1. Check Phone in Profiles
      const { data: phoneCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (phoneCheck) {
        setLoading(false);
        showAlert('Hata', 'Bu telefon numarası zaten kullanımda.');
        return;
      }

      // 2. Check TC Identity No (if personnel)
      if (formData.role === 'personnel' && formData.tc_identity_no) {
        const { data: tcCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('tc_identity_no', formData.tc_identity_no)
          .maybeSingle();

        if (tcCheck) {
          setLoading(false);
          showAlert('Hata', 'Bu TC Kimlik No zaten kullanımda.');
          return;
        }
      }
      setLoading(false);
    }

    console.log('Pre-check passed, creating user...');
    try {
      if (editingUser) {
        const updateData: any = {
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          avatar_url: formData.avatar_url || null,
        };

        if (formData.role === 'personnel') {
          updateData.city = formData.city || null;
          updateData.district = formData.district || null;
          updateData.company_id = null;
          updateData.tc_identity_no = formData.tc_identity_no || null;
          updateData.birth_date = formData.birth_date || null;
          updateData.service_modules = [];
        } else {
          updateData.company_id = formData.company_id || null;
          updateData.city = null;
          updateData.district = null;
          updateData.tc_identity_no = null;
          updateData.birth_date = null;
          updateData.service_modules = formData.role === 'operations' || formData.role === 'project_manager'
            ? formData.service_modules
            : ['personnel', 'technical'];
        }

        console.log('Updating user with data:', updateData, 'User ID:', editingUser.id);
        const { data: updateResult, error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', editingUser.id)
          .select();

        console.log('Update result:', updateResult, 'Error:', error);
        if (error) throw error;

        if (formData.role === 'project_manager') {
          await supabase.from('project_managers').delete().eq('manager_id', editingUser.id);

          const insertData = formData.project_ids.map(projectId => ({
            project_id: projectId,
            manager_id: editingUser.id,
          }));
          await supabase.from('project_managers').insert(insertData);

          // Ayrıca personel listesine de ekle (Varsa ekleme, yoksa ekle)
          for (const projectId of formData.project_ids) {
            const { data: existing } = await supabase
              .from('project_assignments')
              .select('id')
              .eq('project_id', projectId)
              .eq('personnel_id', editingUser.id)
              .is('removed_at', null)
              .maybeSingle();

            if (!existing) {
              await supabase.from('project_assignments').insert({
                project_id: projectId,
                personnel_id: editingUser.id,
                assigned_at: new Date().toISOString(),
              });
            }
          }
        }

        if (formData.role === 'personnel') {
          await supabase.from('profile_personnel_types').delete().eq('profile_id', editingUser.id);

          if (formData.personnel_type_ids.length > 0) {
            const insertData = formData.personnel_type_ids.map(typeId => ({
              profile_id: editingUser.id,
              personnel_type_id: typeId,
            }));
            await supabase.from('profile_personnel_types').insert(insertData);
          }
        }

        await loadData();
        showAlert('Başarılı', 'Kullanıcı güncellendi');
      } else {
        const formattedPhone = formData.phone.startsWith('+')
          ? formData.phone
          : `+90${formData.phone}`;

        console.log('Getting session...');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('No session found');
          throw new Error('Oturum bulunamadı');
        }

        console.log('Session found, calling edge function...');
        const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-user`;
        console.log('API URL:', apiUrl);

        const payload: any = {
          phone: formattedPhone,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          avatar_url: formData.avatar_url || null,
        };

        if (formData.role === 'personnel') {
          payload.city = formData.city || null;
          payload.district = formData.district || null;
          payload.company_id = null;
          payload.tc_identity_no = formData.tc_identity_no || null;
          payload.birth_date = formData.birth_date || null;
          payload.service_modules = [];
        } else {
          payload.company_id = formData.company_id || null;
          payload.city = null;
          payload.district = null;
          payload.tc_identity_no = null;
          payload.birth_date = null;
          payload.service_modules = formData.role === 'operations' || formData.role === 'project_manager'
            ? formData.service_modules
            : ['personnel', 'technical'];
        }
        console.log('Payload:', payload);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response body:', result);

        if (!response.ok) {
          throw new Error(result.error || 'Kullanıcı oluşturulamadı');
        }

        if (formData.role === 'project_manager' && formData.project_ids.length > 0 && result.user_id) {
          const insertData = formData.project_ids.map(projectId => ({
            project_id: projectId,
            manager_id: result.user_id,
          }));
          await supabase.from('project_managers').insert(insertData);

          // Ayrıca personel listesine de ekle
          const assignmentData = formData.project_ids.map(projectId => ({
            project_id: projectId,
            personnel_id: result.user_id,
            assigned_at: new Date().toISOString(),
          }));
          await supabase.from('project_assignments').insert(assignmentData);
        }

        if (formData.role === 'personnel' && formData.personnel_type_ids.length > 0 && result.user_id) {
          const insertData = formData.personnel_type_ids.map(typeId => ({
            profile_id: result.user_id,
            personnel_type_id: typeId,
          }));
          await supabase.from('profile_personnel_types').insert(insertData);
        }

        await loadData();
        showAlert('Başarılı', 'Kullanıcı oluşturuldu');
      }

      closeModal();
    } catch (error: any) {
      console.error('Error in handleSave:', error);

      let errorMessage = 'İşlem başarısız';
      const rawError = error.message || '';

      if (rawError.includes('birth_date_min_age')) {
        errorMessage = 'Personel 18 yaşından küçük olamaz.';
      } else if (rawError.includes('unique constraint') || rawError.includes('already exists')) {
        if (rawError.includes('phone')) {
          errorMessage = 'Bu telefon numarası sistemde zaten kayıtlı.';
        } else if (rawError.includes('email')) {
          errorMessage = 'Bu e-posta adresi sistemde zaten kayıtlı.';
        } else if (rawError.includes('tc_identity_no')) {
          errorMessage = 'Bu TC Kimlik No sistemde zaten kayıtlı.';
        } else {
          errorMessage = 'Bu kayıt sistemde zaten mevcut.';
        }
      } else if (rawError.includes('auth/email-already-in-use') || rawError.includes('email address has already been registered')) {
        errorMessage = 'Bu e-posta adresi zaten kullanımda.';
      } else if (rawError.includes('auth/invalid-email')) {
        errorMessage = 'Geçersiz e-posta adresi.';
      } else if (rawError.includes('auth/weak-password') || rawError.includes('Password should be at least')) {
        errorMessage = 'Şifre çok zayıf. En az 6 karakter olmalı.';
      } else if (rawError.includes('phone number already exists')) {
        errorMessage = 'Bu telefon numarası sistemde zaten kayıtlı.';
      } else {
        errorMessage = rawError;
      }

      showAlert('Hata', errorMessage);
    }
  };

  const handleDelete = async (userId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?');
      if (!confirmed) return;

      try {
        console.log('Deleting user:', userId);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Oturum bulunamadı');
        }

        const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`;
        console.log('API URL:', apiUrl);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        });

        const result = await response.json();
        console.log('Delete result:', result);

        if (!response.ok) {
          throw new Error(result.error || 'Silme başarısız');
        }

        console.log('Delete successful, reloading data...');
        await loadData();
        console.log('Data reloaded');
        window.alert('Kullanıcı başarıyla silindi');
      } catch (error: any) {
        console.error('Delete exception:', error);
        window.alert('Hata: ' + (error.message || 'Silme başarısız'));
      }
    } else {
      showAlert('Emin misiniz?', 'Bu kullanıcıyı silmek istediğinize emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting user:', userId);

              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                throw new Error('Oturum bulunamadı');
              }

              const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`;
              console.log('API URL:', apiUrl);

              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id: userId }),
              });

              const result = await response.json();
              console.log('Delete result:', result);

              if (!response.ok) {
                throw new Error(result.error || 'Silme başarısız');
              }

              console.log('Delete successful, reloading data...');
              await loadData();
              console.log('Data reloaded');
              showAlert('Başarılı', 'Kullanıcı silindi');
            } catch (error: any) {
              console.error('Delete exception:', error);
              showAlert('Hata', error.message || 'Silme başarısız');
            }
          },
        },
      ]);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      personnel: 'Personel',
      project_manager: 'Proje Yöneticisi',
      operations: 'Operasyon',
      admin: 'Admin',
    };
    return labels[role] || role;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kullanıcı Yönetimi</Text>
        <TouchableOpacity onPress={() => openModal()}>
          <Plus size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Ad, telefon ile ara..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.emptyText}>Yükleniyor...</Text>
        ) : filteredUsers.length === 0 ? (
          <Text style={styles.emptyText}>Kullanıcı bulunamadı</Text>
        ) : (
          <>
            {filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                {user.avatar_url ? (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={styles.userAvatar}
                  />
                ) : (
                  <View style={styles.userIcon}>
                    <User size={20} color={COLORS.primary} />
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.full_name}</Text>
                  <Text style={styles.userPhone}>{user.phone || 'Telefon yok'}</Text>
                  <Text style={styles.userRole}>{getRoleLabel(user.role)}</Text>
                  {user.company && <Text style={styles.userCompany}>{user.company.name}</Text>}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => openModal(user)} style={styles.editBtn}>
                    <Pencil size={18} color={COLORS.blue} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(user.id)} style={styles.deleteBtn}>
                    <Trash2 size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {!searchQuery.trim() && totalCount > itemsPerPage && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.paginationBtn, currentPage === 1 && styles.paginationBtnDisabled]}
                  onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <Text style={[styles.paginationBtnText, currentPage === 1 && styles.paginationBtnTextDisabled]}>Önceki</Text>
                </TouchableOpacity>

                <Text style={styles.paginationInfo}>
                  {currentPage} / {Math.ceil(totalCount / itemsPerPage)} (Toplam: {totalCount})
                </Text>

                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    currentPage >= Math.ceil(totalCount / itemsPerPage) && styles.paginationBtnDisabled
                  ]}
                  onPress={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                >
                  <Text style={[
                    styles.paginationBtnText,
                    currentPage >= Math.ceil(totalCount / itemsPerPage) && styles.paginationBtnTextDisabled
                  ]}>Sonraki</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
            </Text>

            <ScrollView>
              <InputGroup
                placeholder="Ad Soyad"
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
              />

              <InputGroup
                placeholder="Telefon (5XX...)"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />

              {!editingUser && (
                <InputGroup
                  placeholder="Şifre"
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry
                />
              )}

              <Text style={styles.label}>Profil Resmi</Text>
              {formData.avatar_url ? (
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: formData.avatar_url }} style={styles.avatarPreview} />
                  <TouchableOpacity
                    style={styles.removeAvatarBtn}
                    onPress={() => setFormData({ ...formData, avatar_url: '' })}
                  >
                    <Text style={styles.removeAvatarText}>Kaldır</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.imageButtonsRow}>
                <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                  <Camera size={20} color={COLORS.primary} />
                  <Text style={styles.imageBtnText}>Galeriden Seç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageBtn} onPress={takePicture}>
                  <Camera size={20} color={COLORS.primary} />
                  <Text style={styles.imageBtnText}>Fotoğraf Çek</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Rol</Text>
              <View style={styles.roleButtons}>
                {['personnel', 'project_manager', 'operations', 'admin'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      formData.role === role && styles.roleButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        role: role as 'personnel' | 'project_manager' | 'operations' | 'admin',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        formData.role === role && styles.roleButtonTextActive,
                      ]}
                    >
                      {getRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formData.role === 'personnel' && (
                <>
                  <View style={styles.locationSection}>
                    <Text style={styles.label}>TC Kimlik No (Zorunlu)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="11 haneli TC Kimlik No"
                      value={formData.tc_identity_no}
                      onChangeText={(text) => setFormData({ ...formData, tc_identity_no: text.replace(/[^0-9]/g, '').slice(0, 11) })}
                      keyboardType="numeric"
                      maxLength={11}
                    />
                  </View>

                  <View style={styles.locationSection}>
                    <Text style={styles.label}>Doğum Tarihi (Zorunlu)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD (örn: 1990-01-15)"
                      value={formData.birth_date}
                      onChangeText={(text) => setFormData({ ...formData, birth_date: text })}
                    />
                    <Text style={styles.helperText}>Format: Yıl-Ay-Gün (2000-12-31)</Text>
                  </View>

                  <View style={styles.locationSection}>
                    <Text style={styles.label}>İl (Zorunlu)</Text>
                    {formData.city ? (
                      <View style={styles.selectedContainer}>
                        <Text style={styles.selectedValue}>{formData.city}</Text>
                        <TouchableOpacity
                          onPress={() => setFormData({ ...formData, city: '', district: '' })}
                          style={styles.clearButton}
                        >
                          <Text style={styles.clearButtonText}>Temizle</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="İl ara veya aşağıdan seç..."
                          value={citySearch}
                          onChangeText={setCitySearch}
                        />
                        <View style={styles.dropdownContainer}>
                          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                            {filteredCities.map((city) => (
                              <TouchableOpacity
                                key={city}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setFormData({ ...formData, city, district: '' });
                                  setCitySearch('');
                                }}
                              >
                                <Text style={styles.dropdownText}>{city}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </>
                    )}
                  </View>

                  {formData.city && (
                    <View style={styles.locationSection}>
                      <Text style={styles.label}>İlçe (Zorunlu)</Text>
                      {formData.district ? (
                        <View style={styles.selectedContainer}>
                          <Text style={styles.selectedValue}>{formData.district}</Text>
                          <TouchableOpacity
                            onPress={() => setFormData({ ...formData, district: '' })}
                            style={styles.clearButton}
                          >
                            <Text style={styles.clearButtonText}>Temizle</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <TextInput
                            style={styles.input}
                            placeholder="İlçe ara veya aşağıdan seç..."
                            value={districtSearch}
                            onChangeText={setDistrictSearch}
                          />
                          <View style={styles.dropdownContainer}>
                            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                              {filteredDistricts.map((district) => (
                                <TouchableOpacity
                                  key={district}
                                  style={styles.dropdownItem}
                                  onPress={() => {
                                    setFormData({ ...formData, district });
                                    setDistrictSearch('');
                                  }}
                                >
                                  <Text style={styles.dropdownText}>{district}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        </>
                      )}
                    </View>
                  )}

                  <View style={styles.locationSection}>
                    <Text style={styles.label}>Meslek (Çoklu Seçim - Zorunlu)</Text>
                    <PersonnelTypeSelector
                      selectedIds={formData.personnel_type_ids}
                      onSelectionChange={(ids) => setFormData({ ...formData, personnel_type_ids: ids })}
                      allowAddNew={true}
                    />
                    {formData.personnel_type_ids.length === 0 && (
                      <Text style={styles.helperText}>En az bir meslek seçilmelidir</Text>
                    )}
                  </View>
                </>
              )}

              {formData.role !== 'personnel' && (
                <>
                  <Text style={styles.label}>
                    Firma {(formData.role === 'project_manager' || formData.role === 'operations') ? '(Zorunlu)' : ''}
                  </Text>
                  <View style={styles.companyButtons}>
                    {formData.role === 'admin' && (
                      <TouchableOpacity
                        style={[
                          styles.companyButton,
                          !formData.company_id && styles.companyButtonActive,
                        ]}
                        onPress={() => setFormData({ ...formData, company_id: '' })}
                      >
                        <Text
                          style={[
                            styles.companyButtonText,
                            !formData.company_id && styles.companyButtonTextActive,
                          ]}
                        >
                          Yok
                        </Text>
                      </TouchableOpacity>
                    )}
                    {companies.map((company) => (
                      <TouchableOpacity
                        key={company.id}
                        style={[
                          styles.companyButton,
                          formData.company_id === company.id && styles.companyButtonActive,
                        ]}
                        onPress={() => setFormData({ ...formData, company_id: company.id })}
                      >
                        <Text
                          style={[
                            styles.companyButtonText,
                            formData.company_id === company.id && styles.companyButtonTextActive,
                          ]}
                        >
                          {company.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {formData.role === 'project_manager' && (
                <>
                  <Text style={styles.label}>Yetkili Olduğu Projeler (Zorunlu)</Text>
                  {!formData.company_id ? (
                    <View style={styles.emptyStateContainer}>
                      <Text style={styles.emptyStateText}>Önce bir firma seçin</Text>
                    </View>
                  ) : projects.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                      <Text style={styles.emptyStateText}>Seçili firmaya ait proje bulunamadı</Text>
                    </View>
                  ) : (
                    <View style={styles.companyButtons}>
                      {projects.map((project) => {
                        const isSelected = formData.project_ids.includes(project.id);
                        return (
                          <TouchableOpacity
                            key={project.id}
                            style={[
                              styles.companyButton,
                              isSelected && styles.companyButtonActive,
                            ]}
                            onPress={() => {
                              if (isSelected) {
                                setFormData({
                                  ...formData,
                                  project_ids: formData.project_ids.filter(id => id !== project.id),
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  project_ids: [...formData.project_ids, project.id],
                                });
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.companyButtonText,
                                isSelected && styles.companyButtonTextActive,
                              ]}
                            >
                              {project.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {(formData.role === 'operations' || formData.role === 'project_manager') && (
                <ServiceModuleSelector
                  selectedModules={formData.service_modules}
                  onSelectionChange={(modules) => setFormData({ ...formData, service_modules: modules })}
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Kaydet</Text>
              </TouchableOpacity>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  userPhone: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
  },
  userCompany: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    padding: 8,
  },
  deleteBtn: {
    padding: 8,
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  removeAvatarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.danger,
    borderRadius: 6,
  },
  removeAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'white',
  },
  imageBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'white',
  },
  roleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleButtonText: {
    fontSize: 13,
    color: COLORS.text,
  },
  roleButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  companyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  companyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'white',
  },
  companyButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  companyButtonText: {
    fontSize: 13,
    color: COLORS.text,
  },
  companyButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 16,
  },
  paginationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  paginationBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  paginationBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationBtnTextDisabled: {
    color: COLORS.textLight,
  },
  paginationInfo: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  locationSection: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 8,
  },
  dropdownContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownText: {
    fontSize: 15,
    color: COLORS.text,
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
  helperText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  emptyStateContainer: {
    backgroundColor: COLORS.bg,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
});
