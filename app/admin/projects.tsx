import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin, UserPlus, X, Trash2, Search, Building2, QrCode, RefreshCw, Eye } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';

type Manager = {
  id: string;
  full_name: string;
  phone: string;
};

type ProjectManager = {
  manager_id: string;
  manager: Manager;
};

type Project = {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  qr_code_secret: string | null;
  managers: ProjectManager[];
};

export default function AdminProjects() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [qrProject, setQrProject] = useState<Project | null>(null);
  const [availableManagers, setAvailableManagers] = useState<Manager[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingQR, setGeneratingQR] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ managerId: string; projectId: string } | null>(null);
  const [addingManagerId, setAddingManagerId] = useState<string | null>(null);
  const [removingManagerId, setRemovingManagerId] = useState<string | null>(null);
  const [pendingQRData, setPendingQRData] = useState<{ project: Project; location: any; address: string } | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects_greenco')
        .select(`
          id,
          name,
          address,
          is_active,
          qr_code_secret,
          project_managers (
            manager_id,
            manager:profiles!project_managers_manager_id_fkey (
              id,
              full_name,
              phone
            )
          )
        `)
        .order('name');

      if (error) throw error;

      const formattedProjects = (data || []).map((p: any) => ({
        ...p,
        managers: p.project_managers || [],
      }));

      setProjects(formattedProjects);
    } catch (error) {
      console.error('Proje yükleme hatası:', error);
      Alert.alert('Hata', 'Projeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableManagers = async (projectId: string, currentManagerIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'project_manager')
        .order('full_name');

      if (error) throw error;

      const filtered = (data || []).filter(
        (m: Manager) => !currentManagerIds.includes(m.id)
      );

      setAvailableManagers(filtered);
    } catch (error) {
      console.error('Yönetici yükleme hatası:', error);
    }
  };

  const handleOpenModal = (project: Project) => {
    setSelectedProject(project);
    const currentManagerIds = project.managers.map(pm => pm.manager_id);
    loadAvailableManagers(project.id, currentManagerIds);
    setSearchQuery('');
    setModalVisible(true);
  };

  const handleAddManager = async (managerId: string) => {
    if (!selectedProject) return;

    setAddingManagerId(managerId);
    try {
      const { error } = await supabase
        .from('project_managers')
        .insert({
          project_id: selectedProject.id,
          manager_id: managerId,
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Uyarı', 'Bu yönetici zaten atanmış');
        } else {
          throw error;
        }
        return;
      }

      const { data: freshProject, error: fetchError } = await supabase
        .from('projects_greenco')
        .select(`
          *,
          project_managers (
            manager_id,
            manager:profiles!project_managers_manager_id_fkey (
              id,
              full_name,
              phone
            )
          )
        `)
        .eq('id', selectedProject.id)
        .single();

      if (fetchError) throw fetchError;

      const formattedProject = {
        ...freshProject,
        managers: freshProject.project_managers || [],
      };

      setProjects(prev =>
        prev.map(p => p.id === selectedProject.id ? formattedProject : p)
      );

      const currentManagerIds = formattedProject.managers.map((pm: any) => pm.manager_id);
      await loadAvailableManagers(selectedProject.id, currentManagerIds);
      setSelectedProject(formattedProject);

    } catch (error: any) {
      console.error('Yönetici ekleme hatası:', error);
      Alert.alert('Hata', error.message || 'Yönetici eklenemedi');
    } finally {
      setAddingManagerId(null);
    }
  };

  const handleRemoveManager = async (managerId: string, projectId?: string) => {
    console.log('🗑️ handleRemoveManager çağrıldı:', { managerId, projectId, selectedProject: selectedProject?.id });
    const targetProjectId = projectId || selectedProject?.id;
    if (!targetProjectId) {
      console.log('❌ targetProjectId bulunamadı');
      return;
    }
    console.log('✅ targetProjectId:', targetProjectId);

    if (Platform.OS === 'web') {
      setPendingDelete({ managerId, projectId: targetProjectId });
      setDeleteConfirmVisible(true);
    } else {
      Alert.alert(
        'Emin misiniz?',
        'Bu proje yöneticisini kaldırmak istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Kaldır',
            style: 'destructive',
            onPress: () => executeRemoveManager(managerId, targetProjectId),
          },
        ]
      );
    }
  };

  const executeRemoveManager = async (managerId: string, targetProjectId: string) => {
    console.log('🔴 Kaldır butonuna basıldı');
    setRemovingManagerId(managerId);
    setDeleteConfirmVisible(false);
    try {
      console.log('🔵 Supabase delete çağrılıyor:', { targetProjectId, managerId });
      const { error } = await supabase
        .from('project_managers')
        .delete()
        .eq('project_id', targetProjectId)
        .eq('manager_id', managerId);

      if (error) {
        console.log('❌ Silme hatası:', error);
        throw error;
      }
      console.log('✅ Silme başarılı, fresh project çekiliyor');

      const { data: freshProject, error: fetchError } = await supabase
        .from('projects_greenco')
        .select(`
          *,
          project_managers (
            manager_id,
            manager:profiles!project_managers_manager_id_fkey (
              id,
              full_name,
              phone
            )
          )
        `)
        .eq('id', targetProjectId)
        .single();

      if (fetchError) throw fetchError;

      const formattedProject = {
        ...freshProject,
        managers: freshProject.project_managers || [],
      };

      setProjects(prev =>
        prev.map(p => p.id === targetProjectId ? formattedProject : p)
      );

      if (selectedProject?.id === targetProjectId) {
        const currentManagerIds = formattedProject.managers.map((pm: any) => pm.manager_id);
        await loadAvailableManagers(targetProjectId, currentManagerIds);
        setSelectedProject(formattedProject);
      }

    } catch (error: any) {
      console.error('Yönetici kaldırma hatası:', error);
      if (Platform.OS === 'web') {
        alert(error.message || 'Yönetici kaldırılamadı');
      } else {
        Alert.alert('Hata', error.message || 'Yönetici kaldırılamadı');
      }
    } finally {
      setRemovingManagerId(null);
      setPendingDelete(null);
    }
  };

  const handleGenerateQR = async (project: Project) => {
    setGeneratingQR(true);
    console.log('QR kod oluşturma başladı...');

    try {
      console.log('Konum izni isteniyor...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Konum izin durumu:', status);

      if (status !== 'granted') {
        setGeneratingQR(false);
        Alert.alert('Konum İzni Gerekli', 'QR kod oluşturmak için konum izni vermeniz gerekiyor.');
        return;
      }

      console.log('GPS konumu alınıyor...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      console.log('GPS konumu alındı:', location.coords.latitude, location.coords.longitude);

      let addressText = 'Konum bilgisi alınamadı';
      try {
        console.log('Adres bilgisi çevriliyor...');
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        console.log('Reverse geocode sonucu:', reverseGeocode);

        if (reverseGeocode && reverseGeocode.length > 0) {
          const addr = reverseGeocode[0];
          const parts = [];
          if (addr.street) parts.push(addr.street);
          if (addr.district) parts.push(addr.district);
          if (addr.city) parts.push(addr.city);
          if (addr.region && !parts.includes(addr.region)) parts.push(addr.region);
          addressText = parts.length > 0 ? parts.join(', ') : 'Adres bilgisi bulunamadı';
        }
      } catch (geoError) {
        console.log('Adres bilgisi alınamadı, koordinatlar gösteriliyor:', geoError);
        addressText = `Enlem: ${location.coords.latitude.toFixed(6)}, Boylam: ${location.coords.longitude.toFixed(6)}`;
      }

      console.log('Gösterilecek adres:', addressText);

      setPendingQRData({ project, location, address: addressText });
      setConfirmModalVisible(true);
      setGeneratingQR(false);
    } catch (error: any) {
      setGeneratingQR(false);
      console.error('Konum alma hatası detay:', error);
      if (Platform.OS === 'web') {
        alert(`Hata: Konum bilgisi alınamadı - ${error.message || 'Bilinmeyen hata'}`);
      } else {
        Alert.alert('Hata', `Konum bilgisi alınamadı: ${error.message || 'Bilinmeyen hata'}`);
      }
    }
  };

  const handleConfirmQR = async () => {
    if (!pendingQRData) return;

    const { project, location, address } = pendingQRData;
    setConfirmModalVisible(false);
    setGeneratingQR(true);

    console.log('Kullanıcı onayladı, QR kod kaydediliyor...');
    try {
      const newSecret = `project_${project.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { error } = await supabase
        .from('projects_greenco')
        .update({
          qr_code_secret: newSecret,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          geofence_radius_meters: 500
        })
        .eq('id', project.id);

      if (error) throw error;

      console.log('QR kod başarıyla kaydedildi');
      await loadProjects();
      const updatedProject = {
        ...project,
        qr_code_secret: newSecret,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        geofence_radius_meters: 500
      };
      setQrProject(updatedProject);
      setQrModalVisible(true);
      setPendingQRData(null);

      if (Platform.OS === 'web') {
        alert(`Başarılı!\n\nQR kod oluşturuldu ve proje konumu kaydedildi.\n\n📍 ${address}\n\nEnlem: ${location.coords.latitude.toFixed(6)}\nBoylam: ${location.coords.longitude.toFixed(6)}\nYarıçap: 500 metre`);
      } else {
        Alert.alert(
          'Başarılı',
          `QR kod oluşturuldu ve proje konumu kaydedildi.\n\n📍 ${address}\n\nEnlem: ${location.coords.latitude.toFixed(6)}\nBoylam: ${location.coords.longitude.toFixed(6)}\nYarıçap: 500 metre`
        );
      }
    } catch (error: any) {
      console.error('QR kod oluşturma hatası:', error);
      if (Platform.OS === 'web') {
        alert(`Hata: ${error.message || 'QR kod oluşturulamadı'}`);
      } else {
        Alert.alert('Hata', error.message || 'QR kod oluşturulamadı');
      }
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleCancelQR = () => {
    console.log('Kullanıcı iptal etti');
    setConfirmModalVisible(false);
    setPendingQRData(null);
  };

  const handleViewQR = (project: Project) => {
    if (!project.qr_code_secret) {
      Alert.alert('Uyarı', 'Bu proje için henüz QR kod oluşturulmamış');
      return;
    }
    setQrProject(project);
    setQrModalVisible(true);
  };

  const filteredManagers = availableManagers.filter(manager =>
    manager.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    manager.phone.includes(searchQuery)
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proje Yöneticileri</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        ) : projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Building2 size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Henüz proje bulunmuyor</Text>
          </View>
        ) : (
          projects.map((project) => (
            <View key={project.id} style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: project.is_active ? '#dcfce7' : '#fee2e2' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: project.is_active ? '#16a34a' : '#dc2626' }
                      ]}>
                        {project.is_active ? 'Aktif' : 'Pasif'}
                      </Text>
                    </View>
                  </View>
                  {project.address && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <MapPin size={12} color={COLORS.textLight} />
                      <Text style={styles.projectAddress}> {project.address}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleOpenModal(project)}
                >
                  <UserPlus size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.qrSection}>
                <View style={styles.qrHeader}>
                  <QrCode size={20} color={COLORS.primary} />
                  <Text style={styles.qrTitle}>QR Kod</Text>
                </View>
                <View style={styles.qrButtonGroup}>
                  {project.qr_code_secret && (
                    <TouchableOpacity
                      style={styles.qrButtonSecondary}
                      onPress={() => handleViewQR(project)}
                    >
                      <Eye size={18} color={COLORS.primary} />
                      <Text style={styles.qrButtonSecondaryText}>Görüntüle</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.qrButton, !project.qr_code_secret && { flex: 1 }]}
                    onPress={() => {
                      console.log('QR butona basıldı!', project.name);
                      handleGenerateQR(project);
                    }}
                    disabled={generatingQR}
                  >
                    {generatingQR ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <RefreshCw size={18} color="white" />
                        <Text style={styles.qrButtonText}>
                          {project.qr_code_secret ? 'Yenile' : 'Oluştur'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {project.qr_code_secret && (
                  <Text style={styles.qrStatus}>QR kod aktif</Text>
                )}
              </View>

              <View style={styles.managersSection}>
                <Text style={styles.managersTitle}>
                  Proje Yöneticileri ({project.managers.length})
                </Text>
                {project.managers.length === 0 ? (
                  <Text style={styles.noManagerText}>Henüz proje yöneticisi atanmamış</Text>
                ) : (
                  project.managers.map((pm) => (
                    <View key={pm.manager_id} style={styles.managerItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.managerName}>{pm.manager.full_name}</Text>
                        <Text style={styles.managerPhone}>{pm.manager.phone}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => {
                          console.log('🔴 Sil butonuna tıklandı:', { managerId: pm.manager_id, projectId: project.id });
                          handleRemoveManager(pm.manager_id, project.id);
                        }}
                        disabled={removingManagerId === pm.manager_id}
                      >
                        {removingManagerId === pm.manager_id ? (
                          <ActivityIndicator size="small" color={COLORS.error} />
                        ) : (
                          <Trash2 size={16} color={COLORS.error} />
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Proje Yöneticisi Ekle</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedProject && (
              <>
                <View style={styles.modalProjectInfo}>
                  <Text style={styles.modalProjectName}>{selectedProject.name}</Text>
                  <Text style={styles.modalProjectSub}>
                    Mevcut Yönetici: {selectedProject.managers.length}
                  </Text>
                </View>

                <View style={styles.searchContainer}>
                  <Search size={20} color={COLORS.textLight} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Yönetici ara..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <ScrollView style={styles.modalBody}>
                  {filteredManagers.length === 0 ? (
                    <Text style={styles.noManagerText}>
                      {searchQuery ? 'Arama sonucu bulunamadı' : 'Tüm yöneticiler atanmış'}
                    </Text>
                  ) : (
                    filteredManagers.map((manager) => (
                      <TouchableOpacity
                        key={manager.id}
                        style={[
                          styles.managerSelectItem,
                          addingManagerId === manager.id && styles.managerSelectItemDisabled
                        ]}
                        onPress={() => handleAddManager(manager.id)}
                        disabled={addingManagerId === manager.id}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.managerName}>{manager.full_name}</Text>
                          <Text style={styles.managerPhone}>{manager.phone}</Text>
                        </View>
                        <View style={styles.addIcon}>
                          {addingManagerId === manager.id ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                          ) : (
                            <UserPlus size={18} color={COLORS.primary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={handleCancelQR}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Konum Onayı</Text>
            <Text style={styles.confirmMessage}>
              QR kod oluşturulacak ve aşağıdaki konum proje konumu olarak kaydedilecek (Yarıçap: 500m):
            </Text>
            {pendingQRData && (
              <View style={styles.locationBox}>
                <MapPin size={20} color={COLORS.primary} />
                <Text style={styles.locationBoxText}>{pendingQRData.address}</Text>
              </View>
            )}
            <Text style={styles.confirmQuestion}>Emin misiniz?</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelQR}>
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmQR}>
                <Text style={styles.confirmButtonText}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={qrModalVisible} transparent animationType="fade">
        <Pressable style={styles.qrModalOverlay} onPress={() => setQrModalVisible(false)}>
          <View style={styles.qrModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>{qrProject?.name}</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {qrProject?.qr_code_secret && (
              <View style={styles.qrCodeContainer}>
                <QRCode
                  value={qrProject.qr_code_secret}
                  size={280}
                  backgroundColor="white"
                />
                <Text style={styles.qrInstruction}>
                  Bu QR kodu yazdırıp proje girişine asabilirsiniz
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteConfirmVisible(false)}>
          <View style={styles.deleteModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.deleteTitle}>Emin misiniz?</Text>
            <Text style={styles.deleteMessage}>
              Bu proje yöneticisini kaldırmak istediğinize emin misiniz?
            </Text>
            <View style={styles.deleteButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setDeleteConfirmVisible(false);
                  setPendingDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  if (pendingDelete) {
                    executeRemoveManager(pendingDelete.managerId, pendingDelete.projectId);
                  }
                }}
              >
                <Text style={styles.confirmButtonText}>Kaldır</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
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
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
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
  loadingText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 14,
    marginTop: 12,
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  projectAddress: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  managersSection: {
    padding: 16,
  },
  managersTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noManagerText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  managerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    marginBottom: 8,
  },
  managerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  managerPhone: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  modalProjectInfo: {
    padding: 16,
    backgroundColor: COLORS.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalProjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalProjectSub: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  managerSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    marginBottom: 8,
  },
  managerSelectItemDisabled: {
    opacity: 0.5,
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  qrTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  qrButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  qrStatus: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  qrButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  qrButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  qrButtonSecondaryText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },
  qrCodeContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  qrInstruction: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 280,
  },
  confirmModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 16,
    lineHeight: 20,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    marginBottom: 16,
  },
  locationBoxText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  confirmQuestion: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  deleteModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteMessage: {
    fontSize: 15,
    color: COLORS.textLight,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
});
