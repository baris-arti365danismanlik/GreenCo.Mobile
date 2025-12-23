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
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/theme';
import { ArrowLeft, Save, CircleCheck as CheckCircle, Camera, Image as ImageIcon, X, Video, AlertCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TURKISH_CITIES, DISTRICTS } from '@/constants/locations';
import * as ImagePicker from 'expo-image-picker';

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

export default function CreateManagerTechnicalRequest() {
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
    const [showCityDropdown, setShowCityDropdown] = useState(false);
    const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);

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
                .select('serial_number, model, warranty_end_date')
                .eq('asset_code', assetCode)
                .not('serial_number', 'is', null)
                .not('model', 'is', null)
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
                    warranty_end_date: formattedDate,
                }));
            }
        } catch (error) {
            console.error('Error loading asset code details:', error);
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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Managed Projects Filtering
            const { data: managedProjects } = await supabase
                .from('project_managers')
                .select('project_id')
                .eq('manager_id', user.id)
                .eq('manager_id', user.id);

            const projectIds = managedProjects?.map(pm => pm.project_id) || [];

            if (projectIds.length === 0) {
                Alert.alert('Uyarı', 'Size atanmış aktif bir proje bulunmuyor.');
                setLoading(false);
                return;
            }

            const [typesResult, companiesResult, projectsResult, roomAreasResult] = await Promise.all([
                supabase.from('technical_service_types').select('id, name, category_type').order('name'),
                supabase.from('companies').select('id, name').eq('is_active', true),
                supabase.from('projects_greenco').select('id, name, company_id').in('id', projectIds).eq('is_active', true),
                supabase.from('technical_service_requests').select('room_area').in('project_id', projectIds).not('room_area', 'is', null),
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
                router.back(); // Go back to technical requests list
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
                                                        {formData.asset_code === code && (
                                                            <CheckCircle size={16} color={COLORS.primary} />
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                        </ScrollView>
                                    </View>
                                </View>
                            </Modal>

                            <View style={styles.field}>
                                <Text style={styles.label}>Marka *</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                    {brands.map((brand) => (
                                        <TouchableOpacity
                                            key={brand.id}
                                            style={[
                                                styles.chip,
                                                formData.brand_id === brand.id && styles.chipSelected,
                                            ]}
                                            onPress={() => setFormData({ ...formData, brand_id: brand.id, model_id: '' })}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    formData.brand_id === brand.id && styles.chipTextSelected,
                                                ]}
                                            >
                                                {brand.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {formData.brand_id && filteredModels.length > 0 && (
                                <View style={styles.field}>
                                    <Text style={styles.label}>Model</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                        {filteredModels.map((model) => (
                                            <TouchableOpacity
                                                key={model.id}
                                                style={[
                                                    styles.chip,
                                                    formData.model_id === model.id && styles.chipSelected,
                                                ]}
                                                onPress={() => setFormData({ ...formData, model_id: model.id })}
                                            >
                                                <Text
                                                    style={[
                                                        styles.chipText,
                                                        formData.model_id === model.id && styles.chipTextSelected,
                                                    ]}
                                                >
                                                    {model.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <View style={styles.field}>
                                <Text style={styles.label}>Seri No</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Seri numarası..."
                                    value={formData.serial_number}
                                    onChangeText={(text) => setFormData({ ...formData, serial_number: text })}
                                    placeholderTextColor="#9ca3af"
                                />
                            </View>

                            <View style={styles.field}>
                                <Text style={styles.label}>Garanti Bitiş Tarihi</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="GG.AA.YYYY"
                                    value={formData.warranty_end_date}
                                    onChangeText={(text) => setFormData({ ...formData, warranty_end_date: text })}
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="numeric"
                                    maxLength={10}
                                />
                                {isWarrantyValid && (
                                    <View style={styles.warrantyBadge}>
                                        <CheckCircle size={14} color={COLORS.success} />
                                        <Text style={styles.warrantyText}>Garanti Devam Ediyor</Text>
                                    </View>
                                )}
                            </View>

                            {isWarrantyValid && (
                                <TouchableOpacity
                                    style={[
                                        styles.checkboxContainer,
                                        formData.send_to_authorized_service && styles.checkboxActive
                                    ]}
                                    onPress={() => setFormData({
                                        ...formData,
                                        send_to_authorized_service: !formData.send_to_authorized_service
                                    })}
                                >
                                    <View style={[
                                        styles.checkbox,
                                        formData.send_to_authorized_service && styles.checkboxChecked
                                    ]}>
                                        {formData.send_to_authorized_service && <CheckCircle size={14} color="white" />}
                                    </View>
                                    <Text style={styles.checkboxLabel}>Yetkili Servise Yönlendirilsin</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}

                    {selectedServiceType?.category_type === 'location_based' && (
                        <>
                            <View style={styles.field}>
                                <Text style={styles.label}>Oda / Alan *</Text>
                                <TouchableOpacity
                                    style={styles.selector}
                                    onPress={() => setShowRoomAreaDropdown(true)}
                                >
                                    <Text style={[styles.selectorText, !formData.room_area && styles.placeholderText]}>
                                        {formData.room_area || 'Oda veya alan seçin'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Modal visible={showRoomAreaDropdown} transparent animationType="fade">
                                <View style={styles.modalOverlay}>
                                    <View style={styles.modalContent}>
                                        <View style={styles.modalHeader}>
                                            <Text style={styles.modalTitle}>Oda / Alan</Text>
                                            <TouchableOpacity onPress={() => setShowRoomAreaDropdown(false)}>
                                                <X size={24} color={COLORS.secondary} />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.searchContainer}>
                                            <TextInput
                                                style={styles.searchInput}
                                                value={roomAreaSearch}
                                                onChangeText={setRoomAreaSearch}
                                                placeholder="Oda veya alan ara..."
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
                                                .filter(area => area.toLowerCase().includes(roomAreaSearch.toLowerCase()))
                                                .map((area, index) => (
                                                    <TouchableOpacity
                                                        key={index}
                                                        style={[styles.modalItem, formData.room_area === area && styles.modalItemSelected]}
                                                        onPress={() => {
                                                            setFormData({ ...formData, room_area: area });
                                                            setShowRoomAreaDropdown(false);
                                                            setRoomAreaSearch('');
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.modalItemText,
                                                            formData.room_area === area && styles.modalItemTextSelected
                                                        ]}>
                                                            {area}
                                                        </Text>
                                                        {formData.room_area === area && (
                                                            <CheckCircle size={16} color={COLORS.primary} />
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                        </ScrollView>
                                    </View>
                                </View>
                            </Modal>

                            <View style={styles.field}>
                                <Text style={styles.label}>Kat</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Kat bilgisi..."
                                    value={formData.floor}
                                    onChangeText={(text) => setFormData({ ...formData, floor: text })}
                                    placeholderTextColor="#9ca3af"
                                />
                            </View>
                        </>
                    )}

                    <View style={[styles.field, { zIndex: 2000 }]}>
                        <Text style={styles.label}>Konum *</Text>
                        <View style={styles.locationRow}>
                            <View style={{ flex: 1, zIndex: 20 }}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="İl ara..."
                                    value={citySearch}
                                    onChangeText={(text) => {
                                        setCitySearch(text);
                                        setShowCityDropdown(true);
                                    }}
                                    placeholderTextColor="#9ca3af"
                                />
                                {showCityDropdown && citySearch.length > 0 && (
                                    <View style={styles.autocompleteList}>
                                        {filteredCities.slice(0, 3).map((city) => (
                                            <TouchableOpacity
                                                key={city}
                                                style={styles.autocompleteItem}
                                                onPress={() => {
                                                    setFormData({
                                                        ...formData,
                                                        location_city: city,
                                                        location_district: ''
                                                    });
                                                    setCitySearch(city);
                                                    setDistrictSearch('');
                                                    setShowCityDropdown(false);
                                                }}
                                            >
                                                <Text style={styles.autocompleteText}>{city}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <View style={{ flex: 1, zIndex: 10 }}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="İlçe ara..."
                                    value={districtSearch}
                                    onChangeText={(text) => {
                                        setDistrictSearch(text);
                                        setShowDistrictDropdown(true);
                                    }}
                                    placeholderTextColor="#9ca3af"
                                    editable={!!formData.location_city}
                                />
                                {showDistrictDropdown && districtSearch.length > 0 && (
                                    <View style={styles.autocompleteList}>
                                        {filteredDistricts.slice(0, 3).map((district) => (
                                            <TouchableOpacity
                                                key={district}
                                                style={styles.autocompleteItem}
                                                onPress={() => {
                                                    setFormData({ ...formData, location_district: district });
                                                    setDistrictSearch(district);
                                                    setShowDistrictDropdown(false);
                                                }}
                                            >
                                                <Text style={styles.autocompleteText}>{district}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Adres Tarifi *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Açık adres veya konum tarifi..."
                            value={formData.location_address}
                            onChangeText={(text) => setFormData({ ...formData, location_address: text })}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Başlık *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Arıza/talep başlığı..."
                            value={formData.title}
                            onChangeText={(text) => setFormData({ ...formData, title: text })}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Açıklama *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Detaylı açıklama..."
                            value={formData.description}
                            onChangeText={(text) => setFormData({ ...formData, description: text })}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Fotoğraf / Video</Text>
                        <View style={styles.mediaButtons}>
                            <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                                <Camera size={24} color={COLORS.primary} />
                                <Text style={styles.mediaButtonText}>Kamera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.mediaButton} onPress={pickImageFromGallery}>
                                <ImageIcon size={24} color={COLORS.primary} />
                                <Text style={styles.mediaButtonText}>Galeri</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewScroll}>
                            {selectedMedia.map((media, index) => (
                                <View key={index} style={styles.mediaPreview}>
                                    <Image source={{ uri: media.uri }} style={styles.previewImage} />
                                    <TouchableOpacity
                                        style={styles.removeMedia}
                                        onPress={() => removeMedia(index)}
                                    >
                                        <X size={16} color="white" />
                                    </TouchableOpacity>
                                    {media.type === 'video' && (
                                        <View style={styles.videoBadge}>
                                            <Video size={16} color="white" />
                                        </View>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Save size={20} color="white" />
                            <Text style={styles.submitButtonText}>Talebi Oluştur</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={showSuccessModal} transparent animationType="fade">
                <View style={styles.successModalOverlay}>
                    <View style={styles.successModalContent}>
                        <CheckCircle size={64} color={COLORS.success} />
                        <Text style={styles.successTitle}>Talep Oluşturuldu!</Text>
                        <Text style={styles.successMessage}>
                            Teknik servis talebiniz başarıyla alınmıştır.
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
    },
    content: {
        flex: 1,
        padding: 16,
    },
    form: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
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
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: COLORS.text,
    },
    textArea: {
        minHeight: 100,
    },
    selectContainer: {
        flexDirection: 'row',
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
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipSelected: {
        backgroundColor: '#eff6ff',
        borderColor: COLORS.primary,
    },
    chipText: {
        fontSize: 14,
        color: COLORS.textLight,
        fontWeight: '500',
    },
    chipTextSelected: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    selectedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#eff6ff',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    selectedValue: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
    },
    clearButton: {
        backgroundColor: 'white',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    clearButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    dropdownScroll: {
        maxHeight: 200,
        marginTop: 8,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
    },
    dropdownContainer: {
        padding: 8,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    dropdownItemText: {
        fontSize: 15,
        color: COLORS.text,
    },
    selector: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 12,
    },
    selectorText: {
        fontSize: 15,
        color: COLORS.text,
    },
    placeholderText: {
        color: '#9ca3af',
    },
    locationRow: {
        flexDirection: 'row',
        gap: 12,
    },
    autocompleteList: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        zIndex: 1000,
        marginTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    autocompleteItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    autocompleteText: {
        fontSize: 14,
        color: COLORS.text,
    },
    mediaButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    mediaButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#eff6ff',
        padding: 12,
        borderRadius: 12,
    },
    mediaButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    mediaPreviewScroll: {
        flexDirection: 'row',
    },
    mediaPreview: {
        width: 100,
        height: 100,
        borderRadius: 12,
        marginRight: 12,
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    removeMedia: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: COLORS.error,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 8,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 16,
        marginBottom: 32,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
    },
    successModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    successModalContent: {
        backgroundColor: 'white',
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.success,
        marginTop: 16,
        marginBottom: 8,
    },
    successMessage: {
        fontSize: 15,
        color: COLORS.textLight,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    searchContainer: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    searchInput: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: COLORS.text,
    },
    modalList: {
        padding: 8,
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    modalItemSelected: {
        backgroundColor: '#eff6ff',
    },
    modalItemText: {
        fontSize: 15,
        color: COLORS.text,
    },
    modalItemTextSelected: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    modalAddButton: {
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    modalAddButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
        textAlign: 'center',
    },
    warrantyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        backgroundColor: '#dcfce7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    warrantyText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.success,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    checkboxActive: {
        backgroundColor: '#eff6ff',
        borderColor: COLORS.primary,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.textLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    checkboxLabel: {
        fontSize: 15,
        color: COLORS.text,
        fontWeight: '500',
    },
});
