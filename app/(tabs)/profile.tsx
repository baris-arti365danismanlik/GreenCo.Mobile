import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import {
  User,
  Phone,
  Mail,
  Building2,
  LogOut,
  Shield,
  MapPin,
  Edit2,
  IdCard,
  Calendar,
  Camera,
  Briefcase,
  ArrowLeft,
} from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TURKISH_CITIES, DISTRICTS } from '@/constants/locations';
import * as ImagePicker from 'expo-image-picker';
import { PersonnelTypeSelector } from '@/components/PersonnelTypeSelector';

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuth();
  const router = useRouter();
  const [editLocationModal, setEditLocationModal] = useState(false);
  const [editPersonalInfoModal, setEditPersonalInfoModal] = useState(false);
  const [city, setCity] = useState(profile?.city || '');
  const [district, setDistrict] = useState(profile?.district || '');
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [filteredCities, setFilteredCities] = useState<string[]>(TURKISH_CITIES);
  const [filteredDistricts, setFilteredDistricts] = useState<string[]>([]);
  const [tcIdentityNo, setTcIdentityNo] = useState(profile?.tc_identity_no || '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '');
  const [uploading, setUploading] = useState(false);
  const [selectedPersonnelTypeIds, setSelectedPersonnelTypeIds] = useState<string[]>([]);

  useEffect(() => {
    const filtered = TURKISH_CITIES.filter(c =>
      c.toLowerCase().includes(citySearch.toLowerCase())
    );
    setFilteredCities(filtered);
  }, [citySearch]);

  useEffect(() => {
    if (city && DISTRICTS[city]) {
      const filtered = DISTRICTS[city].filter(d =>
        d.toLowerCase().includes(districtSearch.toLowerCase())
      );
      setFilteredDistricts(filtered);
    } else {
      setFilteredDistricts([]);
    }
  }, [city, districtSearch]);

  useEffect(() => {
    if (profile) {
      setCity(profile.city || '');
      setDistrict(profile.district || '');
      setTcIdentityNo(profile.tc_identity_no || '');
      setBirthDate(profile.birth_date || '');
      loadPersonnelTypes();
    }
  }, [profile]);

  const loadPersonnelTypes = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('profile_personnel_types')
        .select('personnel_type_id')
        .eq('profile_id', profile.id);

      if (error) throw error;
      const ids = data?.map(pt => pt.personnel_type_id) || [];
      setSelectedPersonnelTypeIds(ids);
    } catch (error: any) {
      console.error('Error loading personnel types:', error);
    }
  };

  const handlePersonnelTypeChange = async (ids: string[]) => {
    if (!profile?.id) return;

    try {
      await supabase.from('profile_personnel_types').delete().eq('profile_id', profile.id);

      if (ids.length > 0) {
        const insertData = ids.map(typeId => ({
          profile_id: profile.id,
          personnel_type_id: typeId,
        }));
        await supabase.from('profile_personnel_types').insert(insertData);
      }

      setSelectedPersonnelTypeIds(ids);
      Alert.alert('Başarılı', 'Meslek bilgileri güncellendi');
    } catch (error: any) {
      console.error('Error updating personnel types:', error);
      Alert.alert('Hata', 'Meslek bilgileri güncellenirken bir hata oluştu');
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Profile: handleSignOut called');
      console.log('Profile: Calling signOut...');
      await signOut();
      console.log('Profile: Sign out complete, redirecting...');
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Profile: Error during sign out:', error);
      Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu');
    }
  };

  const handleSaveLocation = async () => {
    if (!city) {
      Alert.alert('Hata', 'İl seçimi zorunludur');
      return;
    }
    if (!district) {
      Alert.alert('Hata', 'İlçe seçimi zorunludur');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ city, district })
        .eq('id', profile?.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'Konum bilgileri güncellendi');
      setEditLocationModal(false);
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Güncelleme başarısız');
    }
  };

  const handleSavePersonalInfo = async () => {
    if (profile?.role === 'personnel') {
      if (!tcIdentityNo || tcIdentityNo.length !== 11) {
        Alert.alert('Hata', 'TC Kimlik No 11 haneli olmalıdır');
        return;
      }
      if (!birthDate) {
        Alert.alert('Hata', 'Doğum tarihi zorunludur');
        return;
      }
      if (selectedPersonnelTypeIds.length === 0) {
        Alert.alert('Hata', 'En az bir meslek seçimi zorunludur');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          tc_identity_no: tcIdentityNo,
          birth_date: birthDate
        })
        .eq('id', profile?.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'Kişisel bilgiler güncellendi');
      setEditPersonalInfoModal(false);
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Güncelleme başarısız');
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const handleTakePicture = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Uyarı', 'Kamera özelliği mobil cihazlarda kullanılabilir. Web tarayıcısında galeriden seçim yapabilirsiniz.');
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin gerekiyor');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true);

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi');
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Fotoğraf yüklenemedi');
    } finally {
      setUploading(false);
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Sistem Yöneticisi';
      case 'project_manager':
        return 'Proje Yöneticisi';
      case 'operations':
        return 'Operasyon Merkezi';
      case 'personnel':
        return 'Saha Personeli';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#dc2626';
      case 'project_manager':
        return '#2563eb';
      case 'operations':
        return '#7c3aed';
      case 'personnel':
        return '#059669';
      default:
        return '#6b7280';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profil</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={uploading}
          >
            {profile?.avatar_url ? (
              <View style={styles.avatarImageContainer}>
                <Text style={styles.avatarText}>Fotoğraf Yüklendi</Text>
              </View>
            ) : (
              <>
                <User size={48} color="#059669" />
                {profile?.role === 'personnel' && (
                  <View style={styles.cameraIconBadge}>
                    <Camera size={16} color="white" />
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
          {profile?.role === 'personnel' && !profile?.avatar_url && (
            <Text style={styles.avatarWarning}>Profil fotoğrafı zorunludur</Text>
          )}
          <Text style={styles.name}>{profile?.full_name}</Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: getRoleColor(profile?.role || '') + '20' },
            ]}
          >
            <Shield size={16} color={getRoleColor(profile?.role || '')} />
            <Text
              style={[
                styles.roleText,
                { color: getRoleColor(profile?.role || '') },
              ]}
            >
              {getRoleText(profile?.role || '')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap Bilgileri</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Mail size={20} color="#6b7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>E-posta</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Phone size={20} color="#6b7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Telefon</Text>
                <Text style={styles.infoValue}>
                  {profile?.phone || 'Belirtilmemiş'}
                </Text>
              </View>
            </View>

            {profile?.company_id && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Building2 size={20} color="#6b7280" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Şirket ID</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {profile?.company_id}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {profile?.role === 'personnel' && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => setEditPersonalInfoModal(true)}
                >
                  <View style={styles.infoIcon}>
                    <IdCard size={20} color="#6b7280" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>TC Kimlik No</Text>
                    <Text style={styles.infoValue}>
                      {tcIdentityNo || 'Belirtilmemiş (Zorunlu)'}
                    </Text>
                  </View>
                  <Edit2 size={16} color="#6b7280" />
                </TouchableOpacity>

                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => setEditPersonalInfoModal(true)}
                >
                  <View style={styles.infoIcon}>
                    <Calendar size={20} color="#6b7280" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Doğum Tarihi</Text>
                    <Text style={styles.infoValue}>
                      {birthDate ? new Date(birthDate).toLocaleDateString('tr-TR') : 'Belirtilmemiş (Zorunlu)'}
                    </Text>
                  </View>
                  <Edit2 size={16} color="#6b7280" />
                </TouchableOpacity>

                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Briefcase size={20} color="#6b7280" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Meslek</Text>
                    <PersonnelTypeSelector
                      selectedIds={selectedPersonnelTypeIds}
                      onSelectionChange={handlePersonnelTypeChange}
                      allowAddNew={true}
                    />
                    {selectedPersonnelTypeIds.length === 0 && (
                      <Text style={styles.warningText}>En az bir meslek seçilmelidir</Text>
                    )}
                  </View>
                </View>

                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => setEditLocationModal(true)}
                >
                  <View style={styles.infoIcon}>
                    <MapPin size={20} color="#6b7280" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Konum</Text>
                    <Text style={styles.infoValue}>
                      {city && district ? `${district} / ${city}` : 'Belirtilmemiş (Zorunlu)'}
                    </Text>
                  </View>
                  <Edit2 size={16} color="#6b7280" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Versiyon</Text>
                <Text style={styles.infoValue}>Greenco v1.0.0</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Hesap Durumu</Text>
                <Text style={[styles.infoValue, { color: profile?.is_active ? '#059669' : '#dc2626' }]}>
                  {profile?.is_active ? 'Aktif' : 'Pasif'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color="#dc2626" />
            <Text style={styles.signOutText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Greenco - Saha Personeli Yönetim Sistemi
          </Text>
          <Text style={styles.footerSubtext}>
            QR Kod ve Geofence Teknolojisi ile %100 Doğrulanmış Takip
          </Text>
        </View>
      </ScrollView>

      <Modal visible={editPersonalInfoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kişisel Bilgiler</Text>

            <ScrollView>
              <View style={styles.locationSection}>
                <Text style={styles.label}>Profil Fotoğrafı (Zorunlu)</Text>
                {profile?.avatar_url ? (
                  <View style={styles.avatarPreviewContainer}>
                    <Text style={styles.avatarPreviewText}>Fotoğraf yüklendi ✓</Text>
                    <TouchableOpacity
                      style={styles.changeAvatarBtn}
                      onPress={handlePickImage}
                      disabled={uploading}
                    >
                      <Text style={styles.changeAvatarText}>
                        {uploading ? 'Yükleniyor...' : 'Değiştir'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imageButtonsColumn}>
                    <TouchableOpacity
                      style={styles.imageBtnFull}
                      onPress={handlePickImage}
                      disabled={uploading}
                    >
                      <Camera size={20} color="#059669" />
                      <Text style={styles.imageBtnFullText}>
                        {uploading ? 'Yükleniyor...' : 'Galeriden Seç'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.imageBtnFull}
                      onPress={handleTakePicture}
                      disabled={uploading}
                    >
                      <Camera size={20} color="#059669" />
                      <Text style={styles.imageBtnFullText}>
                        {uploading ? 'Yükleniyor...' : 'Fotoğraf Çek'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.locationSection}>
                <Text style={styles.label}>TC Kimlik No (Zorunlu)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="11 haneli TC Kimlik No"
                  value={tcIdentityNo}
                  onChangeText={(text) => setTcIdentityNo(text.replace(/[^0-9]/g, '').slice(0, 11))}
                  keyboardType="numeric"
                  maxLength={11}
                />
              </View>

              <View style={styles.locationSection}>
                <Text style={styles.label}>Doğum Tarihi (Zorunlu)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD (örn: 1990-01-15)"
                  value={birthDate}
                  onChangeText={setBirthDate}
                />
                <Text style={styles.helperText}>Format: Yıl-Ay-Gün (2000-12-31)</Text>
              </View>

              <View style={styles.locationSection}>
                <Text style={styles.label}>Meslek (Zorunlu)</Text>
                <PersonnelTypeSelector
                  selectedIds={selectedPersonnelTypeIds}
                  onSelectionChange={handlePersonnelTypeChange}
                />
                {selectedPersonnelTypeIds.length === 0 && (
                  <Text style={styles.helperText}>En az bir meslek seçmelisiniz</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setEditPersonalInfoModal(false);
                  setTcIdentityNo(profile?.tc_identity_no || '');
                  setBirthDate(profile?.birth_date || '');
                  loadPersonnelTypes();
                }}
              >
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePersonalInfo}>
                <Text style={styles.saveBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editLocationModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Konum Bilgileri</Text>

            <ScrollView>
              <View style={styles.locationSection}>
                <Text style={styles.label}>İl (Zorunlu)</Text>
                {city ? (
                  <View style={styles.selectedContainer}>
                    <Text style={styles.selectedValue}>{city}</Text>
                    <TouchableOpacity
                      onPress={() => { setCity(''); setDistrict(''); }}
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
                        {filteredCities.map((c) => (
                          <TouchableOpacity
                            key={c}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setCity(c);
                              setDistrict('');
                              setCitySearch('');
                            }}
                          >
                            <Text style={styles.dropdownText}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>

              {city && (
                <View style={styles.locationSection}>
                  <Text style={styles.label}>İlçe (Zorunlu)</Text>
                  {district ? (
                    <View style={styles.selectedContainer}>
                      <Text style={styles.selectedValue}>{district}</Text>
                      <TouchableOpacity
                        onPress={() => setDistrict('')}
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
                          {filteredDistricts.map((d) => (
                            <TouchableOpacity
                              key={d}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setDistrict(d);
                                setDistrictSearch('');
                              }}
                            >
                              <Text style={styles.dropdownText}>{d}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setEditLocationModal(false);
                  setCity(profile?.city || '');
                  setDistrict(profile?.district || '');
                }}
              >
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveLocation}>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarWarning: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 10,
    color: '#d1d5db',
    textAlign: 'center',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  locationSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 8,
  },
  dropdownContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dropdownText: {
    fontSize: 15,
    color: '#111827',
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#d1fae5',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  selectedValue: {
    fontSize: 15,
    color: '#059669',
    fontWeight: '600',
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#059669',
  },
  clearButtonText: {
    fontSize: 13,
    color: '#059669',
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  saveBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  avatarPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#d1fae5',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  avatarPreviewText: {
    fontSize: 15,
    color: '#059669',
    fontWeight: '600',
  },
  changeAvatarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#059669',
  },
  changeAvatarText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  imageButtonsColumn: {
    gap: 8,
  },
  imageBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
    backgroundColor: 'white',
  },
  imageBtnFullText: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '600',
  },
  warningText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});
