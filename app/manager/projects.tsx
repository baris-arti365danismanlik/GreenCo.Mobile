import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MapPin, ChevronRight, LogOut, QrCode, Eye, RefreshCw, X, ArrowLeft, Package, FileText } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';

type Project = {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  managerRequest?: boolean;
  activePersonnelCount?: number;
  inactivePersonnelCount?: number;
  qr_code_secret?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_meters?: number | null;
};

export default function ManagerProjects() {
  const router = useRouter();
  const { signOut, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrProject, setQrProject] = useState<Project | null>(null);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingQRData, setPendingQRData] = useState<{ project: Project; location: any; address: string } | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  useEffect(() => {
    const serviceModules = (profile as any)?.service_modules || [];
    const hasPersonnel = serviceModules.includes('personnel');

    if (profile && profile.role === 'project_manager' && !hasPersonnel) {
      Alert.alert('Yetkisiz Erişim', 'Bu sayfaya erişim yetkiniz yok.', [
        { text: 'Tamam', onPress: () => router.replace('/(auth)/role-select') }
      ]);
      return;
    }

    if (profile?.id) {
      loadProjects();
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        loadProjects();
      }
    }, [profile?.id])
  );

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

  const loadProjects = async () => {
    try {
      console.log('loadProjects başladı, profile:', profile);
      if (!profile?.id) {
        console.log('Profile ID yok, çıkılıyor');
        setLoading(false);
        return;
      }

      console.log('project_managers sorgusu yapılıyor...');
      const { data: managerProjects, error: mpError } = await supabase
        .from('project_managers')
        .select('project_id')
        .eq('manager_id', profile.id);

      console.log('project_managers sonucu:', managerProjects, 'hata:', mpError);

      if (mpError) throw mpError;

      const projectIds = managerProjects?.map(mp => mp.project_id) || [];
      console.log('Proje IDs:', projectIds);

      if (projectIds.length === 0) {
        console.log('Hiç proje ID yok');
        setProjects([]);
        setLoading(false);
        return;
      }

      console.log('projects_greenco sorgusu yapılıyor...');
      const { data, error } = await supabase
        .from('projects_greenco')
        .select('id, name, address, is_active, qr_code_secret, latitude, longitude, geofence_radius_meters')
        .in('id', projectIds)
        .order('name');

      console.log('projects_greenco sonucu:', data, 'hata:', error);

      if (error) throw error;

      const { data: session } = await supabase.auth.getSession();
      let allPersonnel: any[] = [];

      if (session?.session?.access_token) {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-manager-personnel`,
          {
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const result = await response.json();
        if (response.ok) {
          allPersonnel = result.data || [];
        }
      }

      const projectsWithCounts = (data || []).map((project) => {
        const projectPersonnel = allPersonnel.filter((p: any) =>
          p.project_ids?.includes(project.id)
        );

        const activeCount = projectPersonnel.filter((p: any) => p.is_active).length;
        const inactiveCount = projectPersonnel.filter((p: any) => !p.is_active).length;

        return {
          ...project,
          activePersonnelCount: activeCount,
          inactivePersonnelCount: inactiveCount,
        };
      });

      setProjects(projectsWithCounts || []);
      console.log('Projeler set edildi, uzunluk:', projectsWithCounts?.length);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/manager')}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Projelerim</Text>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/manager/approvals')}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Onaylar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}>
            <LogOut size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => router.push('/manager/dashboard')}
        >
          <Text style={styles.dashboardButtonText}>📊 Dashboard'u Görüntüle</Text>
        </TouchableOpacity>

        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/manager/unit-work-orders')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#dbeafe' }]}>
              <Package size={24} color="#3b82f6" />
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionTitle}>Birim Bazlı İş Emirleri</Text>
              <Text style={styles.quickActionSubtitle}>İş emirlerini görüntüle</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/manager/unit-invoices')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#fef3c7' }]}>
              <FileText size={24} color="#f59e0b" />
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionTitle}>Birim Bazlı Hakedişler</Text>
              <Text style={styles.quickActionSubtitle}>Hakedişleri incele</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        ) : projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Henüz proje bulunmuyor</Text>
          </View>
        ) : (
          projects.map((project) => (
            <View key={project.id} style={styles.card}>
              <TouchableOpacity
                onPress={() => router.push(`/manager/project-detail?id=${project.id}`)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.cardTitle}>{project.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: project.is_active ? '#dcfce7' : '#fee2e2' }]}>
                        <Text style={[styles.statusText, { color: project.is_active ? '#16a34a' : '#dc2626' }]}>
                          {project.is_active ? 'Aktif' : 'Pasif'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <MapPin size={12} color={COLORS.textLight} />
                      <Text style={styles.cardSub}> {project.address || 'Adres belirtilmemiş'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                      <Text style={styles.personnelCount}>
                        Aktif Personel: <Text style={{ fontWeight: '700', color: '#16a34a' }}>{project.activePersonnelCount || 0}</Text>
                      </Text>
                      <Text style={styles.personnelCount}>
                        Pasif Personel: <Text style={{ fontWeight: '700', color: '#dc2626' }}>{project.inactivePersonnelCount || 0}</Text>
                      </Text>
                    </View>
                  </View>
                  {project.managerRequest ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>ONAY BEKLİYOR</Text>
                    </View>
                  ) : (
                    <ChevronRight size={20} color={COLORS.textLight} />
                  )}
                </View>
              </TouchableOpacity>

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
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelQR}
      >
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
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelQR}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmQR}
              >
                <Text style={styles.confirmButtonText}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={qrModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModal}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setQrModalVisible(false)}
            >
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>

            {qrProject && (
              <>
                <Text style={styles.modalTitle}>{qrProject.name}</Text>
                <Text style={styles.modalSubtitle}>Proje QR Kodu</Text>

                <View style={styles.qrCodeContainer}>
                  {qrProject.qr_code_secret ? (
                    <QRCode
                      value={qrProject.qr_code_secret}
                      size={200}
                    />
                  ) : (
                    <Text style={styles.noQrText}>QR kod bulunamadı</Text>
                  )}
                </View>

                {qrProject.latitude && qrProject.longitude && (
                  <View style={styles.locationInfo}>
                    <MapPin size={16} color={COLORS.primary} />
                    <Text style={styles.locationText}>
                      Konum: {qrProject.latitude.toFixed(6)}, {qrProject.longitude.toFixed(6)}
                    </Text>
                  </View>
                )}

                {qrProject.geofence_radius_meters && (
                  <Text style={styles.radiusText}>
                    Yarıçap: {qrProject.geofence_radius_meters}m
                  </Text>
                )}
              </>
            )}
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
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  dashboardButton: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 3,
  },
  dashboardButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  quickActionsContainer: {
    marginBottom: 20,
    gap: 12,
  },
  quickActionCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  loadingText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.amber,
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
  personnelCount: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  qrSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  qrTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  qrButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  qrButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  qrButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  qrButtonSecondary: {
    backgroundColor: '#e0f2fe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    flex: 1,
  },
  qrButtonSecondaryText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  qrStatus: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 6,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 24,
  },
  qrCodeContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  noQrText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.text,
  },
  radiusText: {
    fontSize: 12,
    color: COLORS.textLight,
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
});
