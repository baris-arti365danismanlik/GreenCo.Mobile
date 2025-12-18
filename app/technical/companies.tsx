import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import { ArrowLeft, Plus, Building2, Star, Search, X, Pencil, Trash2, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CITIES } from '@/constants/locations';

type Company = {
  id: string;
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

type ServiceType = {
  id: string;
  name: string;
  category_type: string;
};

type AssetBrand = {
  id: string;
  name: string;
  service_type_id: string;
};

export default function TechnicalCompanies() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [assetBrands, setAssetBrands] = useState<AssetBrand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    company_name: '',
    tax_number: '',
    phone: '',
    email: '',
    password: '',
    location_city: '',
    location_district: '',
    bank_name: '',
    bank_account_holder: '',
    iban: '',
    specialty_ids: [] as string[],
    authorized_brands: {} as Record<string, string[]>,
  });

  const [districts, setDistricts] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [selectedServiceTypeForBrand, setSelectedServiceTypeForBrand] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);

  const filteredCities = CITIES.filter((city) =>
    city.name.toLowerCase().includes(citySearch.toLowerCase())
  ).map(c => c.name);

  const filteredDistricts = districts.filter((district) =>
    district.toLowerCase().includes(districtSearch.toLowerCase())
  );

  useEffect(() => {
    if (profile?.role !== 'admin') {
      router.back();
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (formData.location_city) {
      const city = CITIES.find((c) => c.name === formData.location_city);
      const newDistricts = city?.districts || [];
      setDistricts(newDistricts);

      // Only reset district if current district is not in the new city's districts
      if (formData.location_district && !newDistricts.includes(formData.location_district)) {
        setFormData((prev) => ({ ...prev, location_district: '' }));
      }
    } else {
      setDistricts([]);
    }
  }, [formData.location_city]);

  const loadData = async () => {
    try {
      const [companiesResult, typesResult, brandsResult] = await Promise.all([
        supabase.from('technical_service_companies').select('*').order('company_name'),
        supabase.from('technical_service_types').select('id, name, category_type').eq('is_active', true),
        supabase.from('asset_brands').select('id, name, service_type_id').order('name'),
      ]);

      if (companiesResult.data) setCompanies(companiesResult.data);
      if (typesResult.data) setServiceTypes(typesResult.data);
      if (brandsResult.data) setAssetBrands(brandsResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) {
      Alert.alert('Hata', 'Lütfen marka adı girin');
      return;
    }

    if (!selectedServiceTypeForBrand) {
      Alert.alert('Hata', 'Hizmet türü seçilmedi');
      return;
    }

    setAddingBrand(true);
    try {
      const { data: newBrand, error } = await supabase
        .from('asset_brands')
        .insert({
          name: newBrandName.trim(),
          service_type_id: selectedServiceTypeForBrand,
        })
        .select()
        .single();

      if (error) throw error;

      setAssetBrands([...assetBrands, newBrand]);

      const currentBrands = formData.authorized_brands[selectedServiceTypeForBrand] || [];
      setFormData({
        ...formData,
        authorized_brands: {
          ...formData.authorized_brands,
          [selectedServiceTypeForBrand]: [...currentBrands, newBrand.id],
        },
      });

      Alert.alert('Başarılı', 'Yeni marka eklendi ve seçildi');
      setShowAddBrandModal(false);
      setNewBrandName('');
      setSelectedServiceTypeForBrand(null);
    } catch (error: any) {
      console.error('Error adding brand:', error);
      Alert.alert('Hata', error.message || 'Marka eklenirken hata oluştu');
    } finally {
      setAddingBrand(false);
    }
  };

  const openEditModal = async (company: Company) => {
    try {
      const [specialtiesResult, brandsResult] = await Promise.all([
        supabase
          .from('technical_service_company_specialties')
          .select('service_type_id')
          .eq('company_id', company.id),
        supabase
          .from('technical_company_authorized_brands')
          .select('brand_id')
          .eq('company_id', company.id),
      ]);

      const specialtyIds = specialtiesResult.data?.map((s: any) => s.service_type_id) || [];
      const authorizedBrands: Record<string, string[]> = {};

      brandsResult.data?.forEach((ab: any) => {
        const brand = assetBrands.find(b => b.id === ab.brand_id);
        if (brand) {
          if (!authorizedBrands[brand.service_type_id]) {
            authorizedBrands[brand.service_type_id] = [];
          }
          authorizedBrands[brand.service_type_id].push(brand.id);
        }
      });

      // Set districts before setting formData to prevent district from being reset
      const city = CITIES.find((c) => c.name === company.location_city);
      setDistricts(city?.districts || []);

      setFormData({
        company_name: company.company_name,
        tax_number: company.tax_number,
        phone: company.phone,
        email: company.email,
        password: '',
        location_city: company.location_city,
        location_district: company.location_district,
        bank_name: company.bank_name || '',
        bank_account_holder: company.bank_account_holder || '',
        iban: company.iban || '',
        specialty_ids: specialtyIds,
        authorized_brands: authorizedBrands,
      });
      setEditingCompany(company);
      setShowAddModal(true);

    } catch (error) {
      console.error('Error loading company details:', error);
      Alert.alert('Hata', 'Firma bilgileri yüklenemedi');
    }
  };

  const handleToggleActive = async (company: Company) => {
    console.log('handleToggleActive called for company:', company.company_name);
    console.log('Platform.OS:', Platform.OS);
    const newStatus = !company.is_active;
    const action = newStatus ? 'aktif' : 'pasif';

    const confirmMessage = `Bu firmayı ${action} yapmak istediğinizden emin misiniz?`;

    if (Platform.OS === 'web') {
      console.log('Using window.confirm for web');
      const confirmed = window.confirm(confirmMessage);
      console.log('User confirmed:', confirmed);
      if (!confirmed) {
        return;
      }
    } else {
      Alert.alert(
        `Firma ${action === 'aktif' ? 'Aktif' : 'Pasif'} Et`,
        confirmMessage,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: action === 'aktif' ? 'Aktif Et' : 'Pasif Et',
            onPress: async () => {
              await performToggleActive();
            },
          },
        ]
      );
      return;
    }

    await performToggleActive();

    async function performToggleActive() {
      console.log('Updating company status to:', newStatus);
      try {
        const { error } = await supabase
          .from('technical_service_companies')
          .update({ is_active: newStatus })
          .eq('id', company.id);

        if (error) {
          console.error('Company update error:', error);
          throw error;
        }

        console.log('Company status updated successfully');

        // Update profile status too
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_active: newStatus })
          .eq('technical_company_id', company.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
        } else {
          console.log('Profile status updated successfully');
        }

        if (Platform.OS === 'web') {
          alert(`Başarılı: Firma ${action} yapıldı`);
        } else {
          Alert.alert('Başarılı', `Firma ${action} yapıldı`);
        }
        await loadData();
      } catch (error: any) {
        console.error('Error toggling company status:', error);
        if (Platform.OS === 'web') {
          alert(`Hata: ${error.message || 'Firma durumu değiştirilirken hata oluştu'}`);
        } else {
          Alert.alert('Hata', error.message || 'Firma durumu değiştirilirken hata oluştu');
        }
      }
    }
  };

  const handleDelete = async (companyId: string) => {
    console.log('handleDelete called for company ID:', companyId);
    console.log('Platform.OS:', Platform.OS);
    const confirmMessage = 'Bu firmayı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz! Bunun yerine pasif yapmayı düşünün.';

    if (Platform.OS === 'web') {
      console.log('Using window.confirm for web');
      const confirmed = window.confirm(confirmMessage);
      console.log('User confirmed:', confirmed);
      if (!confirmed) {
        return;
      }
    } else {
      Alert.alert(
        'Firma Sil',
        confirmMessage,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              await performDelete();
            },
          },
        ]
      );
      return;
    }

    await performDelete();

    async function performDelete() {
      console.log('Deleting company:', companyId);
      try {
        // Delete the company (CASCADE will handle related records)
        const { error } = await supabase
          .from('technical_service_companies')
          .delete()
          .eq('id', companyId);

        if (error) {
          console.error('Delete error:', error);
          throw error;
        }

        console.log('Company deleted successfully');

        // Also delete the auth user
        const company = companies.find(c => c.id === companyId);
        if (company) {
          try {
            const formattedPhone = company.phone.startsWith('+')
              ? company.phone
              : `+90${company.phone}`;
            const email = `${formattedPhone.replace('+', '')}@greenco.app`;
            console.log('Company deleted, user email:', email);
          } catch (authError) {
            console.error('Error deleting auth user:', authError);
          }
        }

        if (Platform.OS === 'web') {
          alert('Başarılı: Firma silindi');
        } else {
          Alert.alert('Başarılı', 'Firma silindi');
        }
        await loadData();
      } catch (error: any) {
        console.error('Error deleting company:', error);
        if (Platform.OS === 'web') {
          alert(`Hata: ${error.message || 'Firma silinirken hata oluştu'}`);
        } else {
          Alert.alert('Hata', error.message || 'Firma silinirken hata oluştu');
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.company_name.trim()) {
      Alert.alert('Hata', 'Lütfen firma adı girin');
      return;
    }
    if (!formData.tax_number.trim()) {
      Alert.alert('Hata', 'Lütfen vergi numarası girin');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Hata', 'Lütfen telefon girin');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Hata', 'Lütfen e-posta girin');
      return;
    }
    if (!editingCompany && (!formData.password || formData.password.length < 6)) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır');
      return;
    }
    if (!formData.location_city) {
      Alert.alert('Hata', 'Lütfen il seçin');
      return;
    }
    if (!formData.location_district) {
      Alert.alert('Hata', 'Lütfen ilçe seçin');
      return;
    }
    if (formData.specialty_ids.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir uzmanlık alanı seçin');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCompany) {
        // Update existing company
        const { error: companyError } = await supabase
          .from('technical_service_companies')
          .update({
            company_name: formData.company_name,
            tax_number: formData.tax_number,
            email: formData.email,
            location_city: formData.location_city,
            location_district: formData.location_district,
            bank_name: formData.bank_name || null,
            bank_account_holder: formData.bank_account_holder || null,
            iban: formData.iban || null,
          })
          .eq('id', editingCompany.id);

        if (companyError) throw companyError;

        // Update password if provided
        if (formData.password && formData.password.length >= 6) {
          try {
            const formattedPhone = editingCompany.phone.startsWith('+')
              ? editingCompany.phone
              : `+90${editingCompany.phone}`;
            const email = `${formattedPhone.replace('+', '')}@greenco.app`;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı');

            // Use edge function to update password
            const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/reset-all-passwords`;
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: email,
                new_password: formData.password,
              }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
              console.error('Şifre güncelleme hatası:', result);
              Alert.alert('Uyarı', 'Firma bilgileri güncellendi ama şifre güncellenemedi. Lütfen tekrar deneyin.');
            }
          } catch (passwordError) {
            console.error('Şifre güncelleme hatası:', passwordError);
            Alert.alert('Uyarı', 'Firma bilgileri güncellendi ama şifre güncellenemedi.');
          }
        }

        // Update specialties
        await supabase.from('technical_service_company_specialties').delete().eq('company_id', editingCompany.id);
        if (formData.specialty_ids.length > 0) {
          const specialtiesData = formData.specialty_ids.map(serviceTypeId => ({
            company_id: editingCompany.id,
            service_type_id: serviceTypeId,
          }));
          await supabase.from('technical_service_company_specialties').insert(specialtiesData);
        }

        // Update authorized brands
        await supabase.from('technical_company_authorized_brands').delete().eq('company_id', editingCompany.id);
        const authorizedBrandRecords = [];
        for (const serviceTypeId of Object.keys(formData.authorized_brands)) {
          for (const brandId of formData.authorized_brands[serviceTypeId]) {
            authorizedBrandRecords.push({
              company_id: editingCompany.id,
              service_type_id: serviceTypeId,
              brand_id: brandId,
            });
          }
        }
        if (authorizedBrandRecords.length > 0) {
          await supabase.from('technical_company_authorized_brands').insert(authorizedBrandRecords);
        }

        setShowAddModal(false);
        setEditingCompany(null);
        setSuccessMessage('Teknisyen şirketi başarıyla güncellendi');
        setTimeout(() => setSuccessMessage(''), 3000);
        setFormData({
          company_name: '',
          tax_number: '',
          phone: '',
          email: '',
          password: '',
          location_city: '',
          location_district: '',
          bank_name: '',
          bank_account_holder: '',
          iban: '',
          specialty_ids: [],
          authorized_brands: {},
        });
        loadData();
      } else {
        // Create new company
        const formattedPhone = formData.phone.startsWith('+')
          ? formData.phone
          : `+90${formData.phone}`;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Oturum bulunamadı');

        const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-technical-company-users`;

        const requestBody = {
          companies: [{
            company_name: formData.company_name,
            tax_number: formData.tax_number,
            phone: formattedPhone,
            email: formData.email,
            location_city: formData.location_city,
            location_district: formData.location_district,
            bank_name: formData.bank_name || null,
            bank_account_holder: formData.bank_account_holder || null,
            iban: formData.iban || null,
            password: formData.password,
            specialty_ids: formData.specialty_ids,
            authorized_brands: formData.authorized_brands,
          }],
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Kullanıcı oluşturulamadı');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'İşlem başarısız');
        }

        setShowAddModal(false);
        setSuccessMessage('Teknisyen şirketi başarıyla oluşturuldu');
        setTimeout(() => setSuccessMessage(''), 3000);
        setFormData({
          company_name: '',
          tax_number: '',
          phone: '',
          email: '',
          password: '',
          location_city: '',
          location_district: '',
          bank_name: '',
          bank_account_holder: '',
          iban: '',
          specialty_ids: [],
          authorized_brands: {},
        });
        loadData();
      }
    } catch (error: any) {
      console.error('Error adding company:', error);

      if (error.code === '23505') {
        if (error.message.includes('tax_number')) {
          Alert.alert('Hata', 'Bu vergi numarası zaten kayıtlı');
        } else if (error.message.includes('phone')) {
          Alert.alert('Hata', 'Bu telefon numarası zaten kullanımda');
        } else if (error.message.includes('email')) {
          Alert.alert('Hata', 'Bu telefon numarası zaten kullanımda');
        } else {
          Alert.alert('Hata', 'Bu kayıt zaten mevcut');
        }
      } else if (error.message?.includes('User already registered')) {
        Alert.alert('Hata', 'Bu telefon numarası zaten kayıtlı');
      } else {
        Alert.alert('Hata', error.message || 'Şirket eklenirken hata oluştu');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teknisyen Şirketleri</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      {successMessage ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Şirket ara..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content}>
        {filteredCompanies.map((company) => (
          <View key={company.id} style={styles.companyCard}>
            <View style={styles.companyHeader}>
              <Building2 size={24} color={COLORS.primary} />
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{company.company_name}</Text>
                <Text style={styles.companyLocation}>
                  {company.location_district}, {company.location_city}
                </Text>
              </View>
            </View>

            <View style={styles.companyStats}>
              <View style={styles.statItem}>
                <Star size={16} color="#f59e0b" />
                <Text style={styles.statText}>
                  {company.average_rating.toFixed(1)} ({company.total_jobs} iş)
                </Text>
              </View>
            </View>

            <View style={styles.companyMeta}>
              <Text style={styles.metaText}>Tel: {company.phone}</Text>
              <Text style={styles.metaText}>Email: {company.email}</Text>
            </View>

            <View style={styles.statusBadgeContainer}>
              <View style={[styles.statusBadge, company.is_active ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusText}>{company.is_active ? 'Aktif' : 'Pasif'}</Text>
              </View>
            </View>

            <View style={styles.companyActions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => openEditModal(company)}
              >
                <Pencil size={16} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, company.is_active ? styles.statusBtnInactive : styles.statusBtnActive]}
                onPress={() => handleToggleActive(company)}
              >
                {company.is_active ? (
                  <X size={16} color="white" />
                ) : (
                  <Check size={16} color="white" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(company.id)}
              >
                <Trash2 size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCompany ? 'Teknisyen Şirketini Düzenle' : 'Yeni Teknisyen Şirketi'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setEditingCompany(null);
                  setFormData({
                    company_name: '',
                    tax_number: '',
                    phone: '',
                    email: '',
                    password: '',
                    location_city: '',
                    location_district: '',
                    bank_name: '',
                    bank_account_holder: '',
                    iban: '',
                    specialty_ids: [],
                    authorized_brands: {},
                  });
                }}
              >
                <X size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.field}>
                <Text style={styles.label}>Firma Adı *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.company_name}
                  onChangeText={(text) => setFormData({ ...formData, company_name: text })}
                  placeholder="Firma adı"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Vergi Numarası *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.tax_number}
                  onChangeText={(text) => setFormData({ ...formData, tax_number: text })}
                  placeholder="Vergi numarası"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Telefon *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Telefon"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  editable={!editingCompany}
                />
                {editingCompany && (
                  <Text style={styles.infoText}>
                    Telefon numarası değiştirilemez (giriş için kullanılıyor)
                  </Text>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>E-posta *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="E-posta"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Şifre {editingCompany ? '(Boş bırakılırsa değişmez)' : '*'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  placeholder={editingCompany ? "Yeni şifre (opsiyonel)" : "Şifre (min. 6 karakter)"}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>İl *</Text>
                {formData.location_city ? (
                  <View style={styles.selectedContainer}>
                    <Text style={styles.selectedValue}>{formData.location_city}</Text>
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, location_city: '', location_district: '' })}
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
                      placeholderTextColor="#9ca3af"
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
                              setFormData({ ...formData, location_city: city, location_district: '' });
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

              {formData.location_city && (
                <View style={styles.field}>
                  <Text style={styles.label}>İlçe *</Text>
                  {formData.location_district ? (
                    <View style={styles.selectedContainer}>
                      <Text style={styles.selectedValue}>{formData.location_district}</Text>
                      <TouchableOpacity
                        onPress={() => setFormData({ ...formData, location_district: '' })}
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
                        placeholderTextColor="#9ca3af"
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
                                setFormData({ ...formData, location_district: district });
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

              <View style={styles.field}>
                <Text style={styles.label}>Uzmanlık Alanları *</Text>
                <View style={styles.specialtiesContainer}>
                  {serviceTypes.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.specialtyChip,
                        formData.specialty_ids.includes(type.id) && styles.specialtyChipSelected,
                      ]}
                      onPress={() => {
                        const newIds = formData.specialty_ids.includes(type.id)
                          ? formData.specialty_ids.filter((id) => id !== type.id)
                          : [...formData.specialty_ids, type.id];

                        const newAuthorizedBrands = { ...formData.authorized_brands };
                        if (!formData.specialty_ids.includes(type.id)) {
                          newAuthorizedBrands[type.id] = [];
                        } else {
                          delete newAuthorizedBrands[type.id];
                        }

                        setFormData({
                          ...formData,
                          specialty_ids: newIds,
                          authorized_brands: newAuthorizedBrands,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.specialtyText,
                          formData.specialty_ids.includes(type.id) && styles.specialtyTextSelected,
                        ]}
                      >
                        {type.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {formData.specialty_ids
                .map((id) => serviceTypes.find((t) => t.id === id))
                .filter((type) => type && type.category_type === 'asset_based')
                .map((type) => {
                  if (!type) return null;
                  const brandsForType = assetBrands.filter((b) => b.service_type_id === type.id);

                  return (
                    <View key={type.id} style={styles.field}>
                      <View style={styles.labelWithButton}>
                        <Text style={styles.label}>
                          {type.name} - Yetkili Servis Olduğu Markalar
                        </Text>
                        <TouchableOpacity
                          style={styles.addBrandButton}
                          onPress={() => {
                            setSelectedServiceTypeForBrand(type.id);
                            setShowAddBrandModal(true);
                          }}
                        >
                          <Plus size={16} color={COLORS.primary} />
                          <Text style={styles.addBrandButtonText}>Yeni Marka</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.specialtiesContainer}>
                        {brandsForType.map((brand) => (
                          <TouchableOpacity
                            key={brand.id}
                            style={[
                              styles.brandChip,
                              formData.authorized_brands[type.id]?.includes(brand.id) &&
                                styles.brandChipSelected,
                            ]}
                            onPress={() => {
                              const currentBrands = formData.authorized_brands[type.id] || [];
                              const newBrands = currentBrands.includes(brand.id)
                                ? currentBrands.filter((id) => id !== brand.id)
                                : [...currentBrands, brand.id];

                              setFormData({
                                ...formData,
                                authorized_brands: {
                                  ...formData.authorized_brands,
                                  [type.id]: newBrands,
                                },
                              });
                            }}
                          >
                            <Text
                              style={[
                                styles.brandText,
                                formData.authorized_brands[type.id]?.includes(brand.id) &&
                                  styles.brandTextSelected,
                              ]}
                            >
                              {brand.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {brandsForType.length === 0 && (
                        <Text style={styles.noBrandsText}>
                          Bu hizmet türü için henüz marka tanımlanmamış
                        </Text>
                      )}
                    </View>
                  );
                })}

              <View style={styles.field}>
                <Text style={styles.label}>Banka Adı</Text>
                <TextInput
                  style={styles.input}
                  value={formData.bank_name}
                  onChangeText={(text) => setFormData({ ...formData, bank_name: text })}
                  placeholder="Banka adı"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Hesap Sahibi</Text>
                <TextInput
                  style={styles.input}
                  value={formData.bank_account_holder}
                  onChangeText={(text) => setFormData({ ...formData, bank_account_holder: text })}
                  placeholder="Hesap sahibi adı"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>IBAN</Text>
                <TextInput
                  style={styles.input}
                  value={formData.iban}
                  onChangeText={(text) => setFormData({ ...formData, iban: text })}
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
{submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingCompany ? 'Güncelle' : 'Kaydet'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddBrandModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.addBrandModalContent}>
            <View style={styles.addBrandModalHeader}>
              <Text style={styles.addBrandModalTitle}>Yeni Marka Ekle</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddBrandModal(false);
                  setNewBrandName('');
                  setSelectedServiceTypeForBrand(null);
                }}
              >
                <X size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.addBrandModalBody}>
              <Text style={styles.label}>Marka Adı *</Text>
              <TextInput
                style={styles.input}
                value={newBrandName}
                onChangeText={setNewBrandName}
                placeholder="Örn: Bosch, Siemens, Arçelik..."
                placeholderTextColor="#9ca3af"
                autoFocus
              />
            </View>

            <View style={styles.addBrandModalFooter}>
              <TouchableOpacity
                style={styles.addBrandCancelBtn}
                onPress={() => {
                  setShowAddBrandModal(false);
                  setNewBrandName('');
                  setSelectedServiceTypeForBrand(null);
                }}
              >
                <Text style={styles.addBrandCancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBrandSaveBtn, addingBrand && styles.submitBtnDisabled]}
                onPress={handleAddBrand}
                disabled={addingBrand}
              >
                {addingBrand ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.addBrandSaveBtnText}>Ekle</Text>
                )}
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
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    backgroundColor: '#10b981',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  successText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  companyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  companyLocation: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  companyStats: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: COLORS.text,
  },
  companyMeta: {
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  companyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.blue,
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  statusBtnActive: {
    backgroundColor: '#10b981',
  },
  statusBtnInactive: {
    backgroundColor: '#f59e0b',
  },
  statusBadgeContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: '#d1fae5',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
    fontStyle: 'italic',
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
    maxHeight: '90%',
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
  modalForm: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  labelWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addBrandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 6,
  },
  addBrandButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  chipTextSelected: {
    color: 'white',
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specialtyChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  specialtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  specialtyTextSelected: {
    color: 'white',
  },
  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  brandChipSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  brandTextSelected: {
    color: 'white',
  },
  noBrandsText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 8,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
  },
  selectedValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.error,
    borderRadius: 6,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownContainer: {
    maxHeight: 200,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 8,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownText: {
    fontSize: 15,
    color: COLORS.text,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  addBrandModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxWidth: 400,
    width: '90%',
    alignSelf: 'center',
    marginTop: '40%',
  },
  addBrandModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addBrandModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  addBrandModalBody: {
    padding: 20,
  },
  addBrandModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addBrandCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  addBrandCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  addBrandSaveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  addBrandSaveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});
