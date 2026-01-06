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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import { ArrowLeft, Save, CircleCheck as CheckCircle, Camera, Image as ImageIcon, X, Video, AlertCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TURKISH_CITIES, DISTRICTS } from '@/constants/locations';
import * as ImagePicker from 'expo-image-picker';
import FilterableDropdown from '@/components/FilterableDropdown';

type ServiceType = {
  id: string;
  name: string;
  category_type: 'asset_based' | 'location_based';
};

type Company = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  name: string;
  company_id: string;
};

type MediaFile = {
  uri: string;
  type: 'image' | 'video';
  name: string;
};

type Brand = {
  id: string;
  name: string;
};

type Model = {
  id: string;
  brand_id: string;
  name: string;
};

export default function CreateTechnicalRequest() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);

  const [formData, setFormData] = useState({
    company_id: '',
    project_id: '',
    service_type_id: '',
    title: '',
    description: '',
    location_city: '',
    location_district: '',
    location_address: '',
    asset_code: '',
    brand_id: '',
    model_id: '',
    serial_number: '',
    warranty_end_date: '',
    room_area: '',
    floor: '',
    send_to_authorized_service: false,
  });

  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [serviceTypeSearch, setServiceTypeSearch] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [assetCodeSearch, setAssetCodeSearch] = useState('');
  const [roomAreaSearch, setRoomAreaSearch] = useState('');
  const [existingAssetCodes, setExistingAssetCodes] = useState<string[]>([]);
  const [existingRoomAreas, setExistingRoomAreas] = useState<string[]>([]);
  const [showAssetCodeDropdown, setShowAssetCodeDropdown] = useState(false);
  const [showRoomAreaDropdown, setShowRoomAreaDropdown] = useState(false);
  const [filteredCities, setFilteredCities] = useState<string[]>(TURKISH_CITIES);
  const [filteredDistricts, setFilteredDistricts] = useState<string[]>([]);
  const [isWarrantyValid, setIsWarrantyValid] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (formData.company_id) {
      const filtered = projects.filter((p) => p.company_id === formData.company_id);
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects([]);
    }
  }, [formData.company_id, projects]);

  useEffect(() => {
    const loadBrands = async () => {
      if (!formData.service_type_id) {
        setBrands([]);
        setFormData({ ...formData, brand_id: '', model_id: '' });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('asset_brands')
          .select('id, name')
          .or(`service_type_id.eq.${formData.service_type_id},service_type_id.is.null`)
          .order('name');

        if (error) throw error;
        setBrands(data || []);
      } catch (error) {
        console.error('Error loading brands:', error);
      }
    };

    loadBrands();
  }, [formData.service_type_id]);

  useEffect(() => {
    const loadModels = async () => {
      if (!formData.brand_id) {
        setFilteredModels([]);
        setFormData({ ...formData, model_id: '' });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('asset_models')
          .select('id, brand_id, name')
          .eq('brand_id', formData.brand_id)
          .order('name');

        if (error) throw error;
        setFilteredModels(data || []);
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();
  }, [formData.brand_id]);

  useEffect(() => {
    const loadAssetCodes = async () => {
      if (!formData.company_id || !formData.service_type_id) {
        setExistingAssetCodes([]);
        return;
      }

      try {
        let query = supabase
          .from('technical_service_requests')
          .select('asset_code, serial_number, warranty_end_date')
          .eq('company_id', formData.company_id)
          .eq('service_type_id', formData.service_type_id)
          .not('asset_code', 'is', null);

        if (formData.project_id) {
          query = query.eq('project_id', formData.project_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        const uniqueCodes = [...new Set(data?.map(r => r.asset_code).filter(Boolean) || [])];
        setExistingAssetCodes(uniqueCodes.sort());
      } catch (error) {
        console.error('Error loading asset codes:', error);
      }
    };

    loadAssetCodes();
  }, [formData.company_id, formData.project_id, formData.service_type_id]);

  useEffect(() => {
    if (formData.warranty_end_date) {
      const warrantyValid = checkWarrantyValidity(formData.warranty_end_date);
      setIsWarrantyValid(warrantyValid);
      if (!warrantyValid) {
        setFormData({ ...formData, send_to_authorized_service: false });
      }
    } else {
      setIsWarrantyValid(false);
    }
  }, [formData.warranty_end_date]);

  useEffect(() => {
    const filtered = TURKISH_CITIES.filter(city =>
      city.toLowerCase().includes(citySearch.toLowerCase())
    );
    setFilteredCities(filtered);
  }, [citySearch]);

  useEffect(() => {
    if (formData.location_city && DISTRICTS[formData.location_city]) {
      const filtered = DISTRICTS[formData.location_city].filter(district =>
        district.toLowerCase().includes(districtSearch.toLowerCase())
      );
      setFilteredDistricts(filtered);
    } else {
      setFilteredDistricts([]);
    }
  }, [formData.location_city, districtSearch]);

  const requestMediaPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera ve galeri erişimi için izin vermeniz gerekmektedir.');
      return false;
    }
    return true;
  };

  const pickImageFromGallery = async () => {
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets) {
      const newMedia: MediaFile[] = result.assets.map(asset => ({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        name: asset.uri.split('/').pop() || `file_${Date.now()}`,
      }));
      setSelectedMedia([...selectedMedia, ...newMedia]);
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const newMedia: MediaFile = {
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        name: asset.uri.split('/').pop() || `file_${Date.now()}`,
      };
      setSelectedMedia([...selectedMedia, newMedia]);
    }
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  const uploadMediaFiles = async (): Promise<string[]> => {
    if (selectedMedia.length === 0) return [];

    setUploadingMedia(true);
    const uploadedUrls: string[] = [];

    try {
      for (const media of selectedMedia) {
        const fileExt = media.name.split('.').pop();
        const fileName = `${profile?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const response = await fetch(media.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { data, error } = await supabase.storage
          .from('technical-attachments')
          .upload(fileName, uint8Array, {
            contentType: media.type === 'video' ? 'video/mp4' : 'image/jpeg',
            upsert: false,
          });

        if (error) {
          console.error('Upload error:', error);
          throw error;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('technical-attachments')
          .getPublicUrl(data.path);

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Hata', 'Medya dosyaları yüklenirken hata oluştu');
      return [];
    } finally {
      setUploadingMedia(false);
    }
  };

  const loadAssetCodeDetails = async (assetCode: string) => {
    try {
      const { data, error } = await supabase
        .from('technical_service_requests')
        .select('serial_number, brand_id, model_id, warranty_end_date')
        .eq('asset_code', assetCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        let formattedDate = '';
        if (data.warranty_end_date) {
          const date = new Date(data.warranty_end_date);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          formattedDate = `${day}.${month}.${year}`;
        }

        setFormData(prev => ({
          ...prev,
          serial_number: data.serial_number || '',
          brand_id: data.brand_id || '',
          model_id: data.model_id || '',
          warranty_end_date: formattedDate,
        }));
      }
    } catch (error) {
      console.error('Error loading asset code details:', error);
    }
  };

  const handleAddBrand = async (brandName: string) => {
    if (!formData.service_type_id) {
      Alert.alert('Hata', 'Lütfen önce hizmet türü seçin');
      throw new Error('Service type not selected');
    }

    try {
      const { data, error } = await supabase
        .from('asset_brands')
        .insert({
          name: brandName,
          service_type_id: formData.service_type_id
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setBrands([...brands, data]);
        setFormData({ ...formData, brand_id: data.id, model_id: '' });
      }
    } catch (error: any) {
      console.error('Error adding brand:', error);
      if (error.code === '23505') {
        Alert.alert('Hata', 'Bu marka zaten mevcut');
      } else {
        Alert.alert('Hata', 'Marka eklenirken hata oluştu');
      }
      throw error;
    }
  };

  const handleAddModel = async (modelName: string) => {
    if (!formData.brand_id) {
      Alert.alert('Hata', 'Önce marka seçmelisiniz');
      throw new Error('No brand selected');
    }

    try {
      const { data, error } = await supabase
        .from('asset_models')
        .insert({ brand_id: formData.brand_id, name: modelName })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setModels([...models, data]);
        setFilteredModels([...filteredModels, data]); // Update filtered list as well
        setFormData({ ...formData, model_id: data.id });
      }
    } catch (error: any) {
      console.error('Error adding model:', error);
      if (error.code === '23505') {
        Alert.alert('Hata', 'Bu model zaten mevcut');
      } else {
        Alert.alert('Hata', 'Model eklenirken hata oluştu');
      }
      throw error;
    }
  };

  const checkWarrantyValidity = (warrantyDateStr: string): boolean => {
    if (!warrantyDateStr || warrantyDateStr.length !== 10) return false;

    const parts = warrantyDateStr.split('.');
    if (parts.length !== 3) return false;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

    const warrantyDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return warrantyDate >= today;
  };

  const loadInitialData = async () => {
    try {
      const [typesResult, companiesResult, projectsResult, roomAreasResult] = await Promise.all([
        supabase.from('technical_service_types').select('id, name, category_type').eq('is_active', true),
        supabase.from('companies').select('id, name').eq('is_active', true),
        supabase.from('projects_greenco').select('id, name, company_id').eq('is_active', true),
        supabase.from('technical_service_requests').select('room_area').not('room_area', 'is', null),
      ]);

      if (typesResult.data) setServiceTypes(typesResult.data);
      if (companiesResult.data) setCompanies(companiesResult.data);
      if (projectsResult.data) setProjects(projectsResult.data);

      if (roomAreasResult.data) {
        const uniqueRooms = [...new Set(roomAreasResult.data.map(r => r.room_area).filter(Boolean))];
        setExistingRoomAreas(uniqueRooms.sort());
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Hata', 'Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.company_id) {
      Alert.alert('Hata', 'Lütfen firma seçin');
      return;
    }
    if (filteredProjects.length > 0 && !formData.project_id) {
      Alert.alert('Hata', 'Lütfen proje seçin');
      return;
    }
    if (!formData.service_type_id) {
      Alert.alert('Hata', 'Lütfen hizmet tipi seçin');
      return;
    }
    if (selectedServiceType?.category_type === 'asset_based' && !formData.asset_code.trim()) {
      Alert.alert('Hata', 'Lütfen varlık kodu girin veya seçin');
      return;
    }
    if (selectedServiceType?.category_type === 'asset_based' && !formData.brand_id) {
      Alert.alert('Hata', 'Lütfen marka seçin');
      return;
    }
    if (!formData.title.trim()) {
      Alert.alert('Hata', 'Lütfen başlık girin');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('Hata', 'Lütfen açıklama girin');
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
    if (!formData.location_address.trim()) {
      Alert.alert('Hata', 'Lütfen adres girin');
      return;
    }
    if (selectedServiceType?.category_type === 'location_based' && !formData.room_area.trim()) {
      Alert.alert('Hata', 'Lütfen oda/alan bilgisi girin');
      return;
    }

    setSubmitting(true);
    try {
      const attachmentUrls = await uploadMediaFiles();

      let warrantyEndDate = null;
      if (formData.warranty_end_date) {
        const parts = formData.warranty_end_date.split('.');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          warrantyEndDate = `${year}-${month}-${day}`;
        }
      }

      const insertData = {
        ...formData,
        warranty_end_date: warrantyEndDate,
        project_id: formData.project_id || null,
        brand_id: formData.brand_id || null,
        model_id: formData.model_id || null,
        created_by: profile?.id,
        status: 'pending_review',
        attachment_urls: attachmentUrls,
      };

      const { data, error } = await supabase.from('technical_service_requests').insert(insertData).select();

      if (error) {
        console.error('Insert error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      setShowSuccessModal(true);

      setTimeout(() => {
        setShowSuccessModal(false);
        router.replace('/technical/requests');
      }, 2000);
    } catch (error) {
      console.error('Error creating request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert('Hata', 'Talep oluşturulurken hata oluştu: ' + errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={styles.headerTitle}>Yeni Talep Oluştur</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Firma *</Text>
            <View style={styles.selectContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {companies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={[
                      styles.chip,
                      formData.company_id === company.id && styles.chipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, company_id: company.id, project_id: '' })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.company_id === company.id && styles.chipTextSelected,
                      ]}
                    >
                      {company.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {formData.company_id && filteredProjects.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Proje *</Text>
              {formData.project_id ? (
                <View style={styles.selectedContainer}>
                  <Text style={styles.selectedValue}>
                    {filteredProjects.find(p => p.id === formData.project_id)?.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, project_id: '' })}
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
                    placeholderTextColor="#9ca3af"
                  />
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    <View style={styles.dropdownContainer}>
                      {filteredProjects
                        .filter(project =>
                          project.name.toLowerCase().includes(projectSearch.toLowerCase())
                        )
                        .map((project) => (
                          <TouchableOpacity
                            key={project.id}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setFormData({ ...formData, project_id: project.id });
                              setProjectSearch('');
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{project.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Hizmet Tipi *</Text>
            {formData.service_type_id ? (
              <View style={styles.selectedContainer}>
                <Text style={styles.selectedValue}>
                  {serviceTypes.find(t => t.id === formData.service_type_id)?.name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setFormData({
                      ...formData,
                      service_type_id: '',
                      asset_code: '',
                      brand_id: '',
                      model_id: '',
                      serial_number: '',
                      warranty_end_date: '',
                      room_area: '',
                      floor: '',
                    });
                    setSelectedServiceType(null);
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
                  placeholder="Hizmet tipi ara..."
                  value={serviceTypeSearch}
                  onChangeText={setServiceTypeSearch}
                  placeholderTextColor="#9ca3af"
                />
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  <View style={styles.dropdownContainer}>
                    {serviceTypes
                      .filter(type =>
                        type.name.toLowerCase().includes(serviceTypeSearch.toLowerCase())
                      )
                      .map((type) => (
                        <TouchableOpacity
                          key={type.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFormData({
                              ...formData,
                              service_type_id: type.id,
                              asset_code: '',
                              brand_id: '',
                              model_id: '',
                              serial_number: '',
                              warranty_end_date: '',
                              room_area: '',
                              floor: '',
                            });
                            setSelectedServiceType(type);
                            setServiceTypeSearch('');
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{type.name}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>

          {selectedServiceType?.category_type === 'asset_based' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Varlık Kodu *</Text>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setShowAssetCodeDropdown(true)}
                >
                  <Text style={[styles.selectorText, !formData.asset_code && styles.placeholderText]}>
                    {formData.asset_code || 'Varlık kodu ara veya yeni ekle'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Modal visible={showAssetCodeDropdown} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Varlık Kodu</Text>
                      <TouchableOpacity onPress={() => setShowAssetCodeDropdown(false)}>
                        <X size={24} color={COLORS.secondary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                      <TextInput
                        style={styles.searchInput}
                        value={assetCodeSearch}
                        onChangeText={setAssetCodeSearch}
                        placeholder="Varlık kodu ara veya yeni ekle..."
                        placeholderTextColor="#9ca3af"
                        autoFocus
                      />
                    </View>

                    <ScrollView style={styles.modalList}>
                      {assetCodeSearch.trim() && !existingAssetCodes.includes(assetCodeSearch.trim()) && (
                        <TouchableOpacity
                          style={styles.modalAddButton}
                          onPress={() => {
                            setFormData({ ...formData, asset_code: assetCodeSearch.trim() });
                            setShowAssetCodeDropdown(false);
                            setAssetCodeSearch('');
                          }}
                        >
                          <Text style={styles.modalAddButtonText}>+ Yeni: "{assetCodeSearch.trim()}"</Text>
                        </TouchableOpacity>
                      )}
                      {existingAssetCodes
                        .filter(code => code.toLowerCase().includes(assetCodeSearch.toLowerCase()))
                        .map((code, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[styles.modalItem, formData.asset_code === code && styles.modalItemSelected]}
                            onPress={async () => {
                              setFormData({ ...formData, asset_code: code });
                              setShowAssetCodeDropdown(false);
                              setAssetCodeSearch('');
                              await loadAssetCodeDetails(code);
                            }}
                          >
                            <Text style={[
                              styles.modalItemText,
                              formData.asset_code === code && styles.modalItemTextSelected
                            ]}>
                              {code}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      {existingAssetCodes.filter(code => code.toLowerCase().includes(assetCodeSearch.toLowerCase())).length === 0 && !assetCodeSearch.trim() && (
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>Kayıtlı varlık kodu yok</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <FilterableDropdown
                label="Marka *"
                value={formData.brand_id}
                onValueChange={(value) => setFormData({ ...formData, brand_id: value, model_id: '' })}
                items={brands}
                placeholder="Marka seçin"
                disabled={!formData.asset_code || existingAssetCodes.includes(formData.asset_code)}
                onAddNew={handleAddBrand}
              />

              <FilterableDropdown
                label="Model"
                value={formData.model_id}
                onValueChange={(value) => setFormData({ ...formData, model_id: value })}
                items={filteredModels}
                placeholder={!formData.brand_id ? "Önce marka seçin" : "Model seçin"}
                disabled={!formData.brand_id || existingAssetCodes.includes(formData.asset_code)}
                onAddNew={handleAddModel}
              />

              <View style={styles.field}>
                <Text style={styles.label}>Seri No</Text>
                <TextInput
                  style={[
                    styles.input,
                    (existingAssetCodes.includes(formData.asset_code) || !formData.asset_code) && styles.inputDisabled
                  ]}
                  value={formData.serial_number}
                  onChangeText={(text) => setFormData({ ...formData, serial_number: text })}
                  placeholder={!formData.asset_code ? "Önce varlık kodu seçin" : "Cihaz seri numarası"}
                  placeholderTextColor="#9ca3af"
                  editable={!existingAssetCodes.includes(formData.asset_code) && !!formData.asset_code}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Garanti Bitiş Tarihi</Text>
                <TextInput
                  style={[
                    styles.input,
                    (existingAssetCodes.includes(formData.asset_code) || !formData.asset_code) && styles.inputDisabled
                  ]}
                  value={formData.warranty_end_date}
                  onChangeText={(text) => {
                    let formatted = text.replace(/[^0-9]/g, '');
                    if (formatted.length >= 2) {
                      formatted = formatted.substring(0, 2) + '.' + formatted.substring(2);
                    }
                    if (formatted.length >= 5) {
                      formatted = formatted.substring(0, 5) + '.' + formatted.substring(5, 9);
                    }

                    if (formatted.length === 10) {
                      const parts = formatted.split('.');
                      const day = parseInt(parts[0]);
                      const month = parseInt(parts[1]);
                      const year = parseInt(parts[2]);

                      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                        Alert.alert('Geçersiz Tarih', 'Lütfen geçerli bir tarih girin (GG.AA.YYYY)');
                        return;
                      }

                      const date = new Date(year, month - 1, day);
                      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
                        Alert.alert('Geçersiz Tarih', 'Girdiğiniz tarih geçerli bir takvim tarihi değil');
                        return;
                      }
                    }

                    setFormData({ ...formData, warranty_end_date: formatted });
                  }}
                  placeholder={!formData.asset_code ? "Önce varlık kodu seçin" : "GG.AA.YYYY"}
                  placeholderTextColor="#9ca3af"
                  editable={!existingAssetCodes.includes(formData.asset_code) && !!formData.asset_code}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              {isWarrantyValid && (
                <View style={styles.warrantyWarningContainer}>
                  <View style={styles.warrantyWarningHeader}>
                    <AlertCircle size={20} color={COLORS.warning} />
                    <Text style={styles.warrantyWarningTitle}>Garanti Kapsamında</Text>
                  </View>
                  <Text style={styles.warrantyWarningText}>
                    Bu cihazın garanti süresi devam ediyor. Mutlaka yetkili servise mi gönderilmeli yoksa genel servis de olabilir mi?
                  </Text>
                  <TouchableOpacity
                    style={styles.warrantyToggleContainer}
                    onPress={() => setFormData({
                      ...formData,
                      send_to_authorized_service: !formData.send_to_authorized_service
                    })}
                  >
                    <View style={[
                      styles.warrantyToggle,
                      formData.send_to_authorized_service && styles.warrantyToggleActive
                    ]}>
                      <View style={[
                        styles.warrantyToggleThumb,
                        formData.send_to_authorized_service && styles.warrantyToggleThumbActive
                      ]} />
                    </View>
                    <Text style={styles.warrantyToggleLabel}>
                      {formData.send_to_authorized_service ? 'Yetkili Servise Gönderilsin' : 'Farketmez'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {selectedServiceType?.category_type === 'location_based' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Oda/Alan *</Text>
                {formData.room_area && !showRoomAreaDropdown ? (
                  <View style={styles.selectedContainer}>
                    <Text style={styles.selectedValue}>{formData.room_area}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setFormData({ ...formData, room_area: '' });
                        setRoomAreaSearch('');
                        setShowRoomAreaDropdown(true);
                      }}
                      style={styles.clearButton}
                    >
                      <Text style={styles.clearButtonText}>Değiştir</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.selector}
                    onPress={() => setShowRoomAreaDropdown(true)}
                  >
                    <Text style={[styles.selectorText, !formData.room_area && styles.placeholderText]}>
                      {formData.room_area || 'Oda/alan ara veya yeni ekle'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Modal visible={showRoomAreaDropdown} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Oda/Alan</Text>
                      <TouchableOpacity onPress={() => setShowRoomAreaDropdown(false)}>
                        <X size={24} color={COLORS.secondary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                      <TextInput
                        style={styles.searchInput}
                        value={roomAreaSearch}
                        onChangeText={setRoomAreaSearch}
                        placeholder="Oda/alan ara veya yeni ekle..."
                        placeholderTextColor="#9ca3af"
                        autoFocus
                      />
                    </View>

                    <ScrollView style={styles.modalList}>
                      {roomAreaSearch.trim() && !existingRoomAreas.includes(roomAreaSearch.trim()) && (
                        <TouchableOpacity
                          style={styles.modalAddButton}
                          onPress={() => {
                            setFormData({ ...formData, room_area: roomAreaSearch.trim() });
                            setShowRoomAreaDropdown(false);
                            setRoomAreaSearch('');
                          }}
                        >
                          <Text style={styles.modalAddButtonText}>+ Yeni: "{roomAreaSearch.trim()}"</Text>
                        </TouchableOpacity>
                      )}
                      {existingRoomAreas
                        .filter(room => room.toLowerCase().includes(roomAreaSearch.toLowerCase()))
                        .map((room, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[styles.modalItem, formData.room_area === room && styles.modalItemSelected]}
                            onPress={() => {
                              setFormData({ ...formData, room_area: room });
                              setShowRoomAreaDropdown(false);
                              setRoomAreaSearch('');
                            }}
                          >
                            <Text style={[
                              styles.modalItemText,
                              formData.room_area === room && styles.modalItemTextSelected
                            ]}>
                              {room}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      {existingRoomAreas.filter(room => room.toLowerCase().includes(roomAreaSearch.toLowerCase())).length === 0 && !roomAreaSearch.trim() && (
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>Kayıtlı oda/alan yok</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <View style={styles.field}>
                <Text style={styles.label}>Kat</Text>
                <TextInput
                  style={styles.input}
                  value={formData.floor}
                  onChangeText={(text) => setFormData({ ...formData, floor: text })}
                  placeholder="Örn: 3. Kat"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Başlık *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder="Örn: Klima arızası"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Açıklama *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Sorunun detaylı açıklaması"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Resim veya Video Ekle</Text>
            <View style={styles.mediaButtonsContainer}>
              <TouchableOpacity style={styles.mediaButton} onPress={pickImageFromGallery}>
                <ImageIcon size={24} color={COLORS.primary} />
                <Text style={styles.mediaButtonText}>Galeri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                <Camera size={24} color={COLORS.primary} />
                <Text style={styles.mediaButtonText}>Kamera</Text>
              </TouchableOpacity>
            </View>
            {selectedMedia.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewScroll}>
                {selectedMedia.map((media, index) => (
                  <View key={index} style={styles.mediaPreviewContainer}>
                    {media.type === 'image' ? (
                      <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                    ) : (
                      <View style={[styles.mediaPreview, styles.videoPlaceholder]}>
                        <Video size={32} color="white" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeMediaButton}
                      onPress={() => removeMedia(index)}
                    >
                      <X size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
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
                  placeholderTextColor="#9ca3af"
                />
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  <View style={styles.dropdownContainer}>
                    {filteredCities.map((city) => (
                      <TouchableOpacity
                        key={city}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setFormData({ ...formData, location_city: city, location_district: '' });
                          setCitySearch('');
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{city}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
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
                    placeholderTextColor="#9ca3af"
                  />
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    <View style={styles.dropdownContainer}>
                      {filteredDistricts.map((district) => (
                        <TouchableOpacity
                          key={district}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFormData({ ...formData, location_district: district });
                            setDistrictSearch('');
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{district}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Adres *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={formData.location_address}
              onChangeText={(text) => setFormData({ ...formData, location_address: text })}
              placeholder="Tam adres"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Save size={20} color="white" />
              <Text style={styles.submitBtnText}>Talep Oluştur</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <CheckCircle size={64} color={COLORS.primary} />
            </View>
            <Text style={styles.successTitle}>Başarılı!</Text>
            <Text style={styles.successMessage}>
              Talep başarıyla oluşturuldu.
            </Text>
            <Text style={styles.successSubMessage}>
              Talepler sayfasına yönlendiriliyorsunuz...
            </Text>
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
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  textarea: {
    minHeight: 100,
  },
  selectContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
  },
  chipScroll: {
    flexGrow: 0,
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
  footer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
  },
  selectedValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  dropdownContainer: {
    padding: 4,
  },
  dropdownItem: {
    padding: 12,
    borderRadius: 6,
  },
  dropdownItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  emptyDropdown: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
  },
  selectorText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
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
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.secondary,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  modalItemText: {
    fontSize: 16,
    color: COLORS.secondary,
  },
  modalItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalAddButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: 8,
  },
  modalAddButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  mediaButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  mediaPreviewScroll: {
    marginTop: 12,
  },
  mediaPreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  mediaPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newItemButton: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  newItemText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  warrantyWarningContainer: {
    backgroundColor: COLORS.warningLight,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  warrantyWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warrantyWarningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  warrantyWarningText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  warrantyToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  warrantyToggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#cbd5e1',
    padding: 2,
    justifyContent: 'center',
  },
  warrantyToggleActive: {
    backgroundColor: COLORS.primary,
  },
  warrantyToggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  warrantyToggleThumbActive: {
    transform: [{ translateX: 24 }],
  },
  warrantyToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },
});
