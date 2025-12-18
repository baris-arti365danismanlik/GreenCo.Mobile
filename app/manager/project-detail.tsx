import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, User, MapPin, Clock, Power, QrCode, RefreshCw, Eye, X, FileText, XCircle, Calendar, Users, Edit2, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import QRCode from 'react-native-qrcode-svg';

type Personnel = {
  id: string;
  full_name: string;
  position: string | null;
  is_active: boolean;
  isWorking?: boolean;
  avatar_url?: string;
};

type PersonnelRequest = {
  id: string;
  personnel_positions: any[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'awaiting_assignment' | 'completed';
  created_at: string;
  project_start_date: string;
  project_end_date: string;
  rejection_reason?: string;
  cancelled_at?: string;
};

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [personnelRequests, setPersonnelRequests] = useState<PersonnelRequest[]>([]);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProject();
      loadPersonnel();
      loadPersonnelRequests();
    }
  }, [id]);

  // Sayfa odaklandığında (edit'ten geri döndüğünde) verileri yenile
  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadPersonnelRequests();
      }
    }, [id])
  );

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects_greenco')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPersonnel = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        console.error('No session token');
        return;
      }

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

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch personnel');
      }

      const allPersonnel = result.data || [];
      const projectPersonnel = allPersonnel.filter((p: any) =>
        p.project_ids?.includes(id)
      );

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const personnelWithStatus = await Promise.all(
        projectPersonnel.map(async (p: any) => {
          const { data: todayAttendance } = await supabase
            .from('attendance_records')
            .select('check_in_time, check_out_time')
            .eq('worker_id', p.id)
            .eq('project_id', id)
            .gte('check_in_time', todayStart.toISOString())
            .maybeSingle();

          const location = [p.city, p.district].filter(Boolean).join(' / ') || null;

          return {
            id: p.id,
            full_name: p.full_name,
            position: p.personnel_types?.name || null,
            is_active: p.is_active,
            user_id: p.id,
            location: location,
            isWorking: todayAttendance && todayAttendance.check_in_time && !todayAttendance.check_out_time,
            avatar_url: p.avatar_url,
          };
        })
      );

      setPersonnel(personnelWithStatus);
    } catch (error) {
      console.error('Error loading personnel:', error);
    }
  };

  const loadPersonnelRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('personnel_requests')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch personnel type names for each request
      const { data: personnelTypes } = await supabase
        .from('personnel_types')
        .select('id, name');

      const typeMap = new Map(personnelTypes?.map(t => [t.id, t.name]) || []);

      // Add personnel_type_name to each position
      const enrichedData = (data || []).map(request => ({
        ...request,
        personnel_positions: request.personnel_positions.map((pos: any) => ({
          ...pos,
          personnel_type_name: pos.personnel_type_id ? typeMap.get(pos.personnel_type_id) : null,
          quantity: pos.count || pos.quantity || 0
        }))
      }));

      setPersonnelRequests(enrichedData);
    } catch (error) {
      console.error('Error loading personnel requests:', error);
    }
  };

  const handleCancelRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    setCancelModalVisible(true);
  };

  const confirmCancelRequest = async () => {
    if (!selectedRequestId) {
      console.log('selectedRequestId yok!');
      return;
    }

    console.log('İptal işlemi başlatılıyor, requestId:', selectedRequestId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Kullanıcı:', user?.id);

      const { data, error } = await supabase
        .from('personnel_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id
        })
        .eq('id', selectedRequestId)
        .select();

      console.log('Update sonucu - data:', data, 'error:', error);

      if (error) throw error;

      // Önce verileri yeniden yükle
      await loadPersonnelRequests();

      // Sonra modal'ı kapat
      setCancelModalVisible(false);
      setSelectedRequestId(null);

      if (Platform.OS === 'web') {
        window.alert('Başarılı! Talep iptal edildi.');
      }
    } catch (error: any) {
      console.error('İptal hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Talep iptal edilemedi'));
      }
    }
  };

  const handleGenerateQR = async () => {
    if (!project) return;

    const confirmed = confirm(
      'Bu proje için yeni bir QR kod oluşturulsun mu? Eski QR kod geçersiz hale gelecektir.'
    );

    if (!confirmed) return;

    try {
      const newSecret = `project_${project.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { error } = await supabase
        .from('projects_greenco')
        .update({ qr_code_secret: newSecret })
        .eq('id', project.id);

      if (error) throw error;

      await loadProject();
      setQrModalVisible(true);
    } catch (error: any) {
      console.error('QR kod oluşturma hatası:', error);
      alert(`Hata: ${error.message || 'QR kod oluşturulamadı'}`);
    }
  };

  const handleViewQR = () => {
    if (!project?.qr_code_secret) {
      alert('Bu proje için henüz QR kod oluşturulmamış');
      return;
    }
    setQrModalVisible(true);
  };

  const toggleProjectStatus = async () => {
    if (!project) return;

    const confirmed = confirm(
      `Projeyi ${project.is_active ? 'pasif' : 'aktif'} duruma getirmek istediğinizden emin misiniz?`
    );

    if (!confirmed) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('projects_greenco')
        .update({ is_active: !project.is_active })
        .eq('id', project.id);

      if (error) throw error;

      alert(`Başarılı: Proje ${!project.is_active ? 'aktif' : 'pasif'} duruma getirildi.`);
      await loadProject();
    } catch (error: any) {
      console.error('Proje durumu güncelleme hatası:', error);
      alert(`Hata: ${error.message || 'Proje durumu güncellenemedi'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading || !project) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerTitle}>{project.name}</Text>
            <View style={[styles.statusBadgeHeader, { backgroundColor: project.is_active ? '#dcfce7' : '#fee2e2' }]}>
              <Text style={[styles.statusTextHeader, { color: project.is_active ? '#16a34a' : '#dc2626' }]}>
                {project.is_active ? 'Aktif' : 'Pasif'}
              </Text>
            </View>
          </View>
          {project.address && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <MapPin size={12} color={COLORS.textLight} />
              <Text style={styles.addressText}>{project.address}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={toggleProjectStatus}
          disabled={updatingStatus}
          style={[styles.statusButton, updatingStatus && { opacity: 0.5 }]}
        >
          <Power size={20} color={project.is_active ? '#dc2626' : '#16a34a'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.qrSection}>
          <View style={styles.qrHeader}>
            <QrCode size={20} color={COLORS.primary} />
            <Text style={styles.qrTitle}>QR Kod Yönetimi</Text>
          </View>
          <View style={styles.qrButtonGroup}>
            {project.qr_code_secret && (
              <TouchableOpacity
                style={styles.qrButtonSecondary}
                onPress={handleViewQR}
              >
                <Eye size={18} color={COLORS.primary} />
                <Text style={styles.qrButtonSecondaryText}>Görüntüle</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.qrButton, !project.qr_code_secret && { flex: 1 }]}
              onPress={handleGenerateQR}
            >
              <RefreshCw size={18} color="white" />
              <Text style={styles.qrButtonText}>
                {project.qr_code_secret ? 'Yenile' : 'Oluştur'}
              </Text>
            </TouchableOpacity>
          </View>
          {project.qr_code_secret && (
            <Text style={styles.qrStatus}>QR kod aktif</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <Users size={20} color={COLORS.primary} />
            <Text style={styles.summaryLabel}>Atanan Personel</Text>
            <Text style={styles.summaryValue}>{personnel.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <FileText size={20} color="#f59e0b" />
            <Text style={styles.summaryLabel}>Bekleyen Talepler</Text>
            <Text style={styles.summaryValue}>
              {personnelRequests.filter(r => r.status === 'pending').length}
            </Text>
          </View>
        </View>

        {personnelRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>İSTENİLEN PERSONEL</Text>
            {personnelRequests.map((request) => {
              const totalRequested = request.personnel_positions.reduce(
                (sum: number, pos: any) => sum + (pos.quantity || pos.count || 0),
                0
              );

              const statusColors = {
                approved: { bg: '#dcfce7', text: '#16a34a', label: 'Onaylandı' },
                rejected: { bg: '#fee2e2', text: '#dc2626', label: 'Reddedildi' },
                cancelled: { bg: '#f3f4f6', text: '#6b7280', label: 'İptal Edildi' },
                pending: { bg: '#fef3c7', text: '#f59e0b', label: 'Onay Bekliyor' },
                awaiting_assignment: { bg: '#dbeafe', text: '#2563eb', label: 'Atama Bekleniyor' },
                completed: { bg: '#dcfce7', text: '#16a34a', label: 'Tamamlandı' },
              };

              const statusColor = statusColors[request.status as keyof typeof statusColors] || statusColors.pending;

              // Show edit/cancel buttons for pending and awaiting_assignment (but not cancelled)
              const canEdit = (request.status === 'pending' || request.status === 'awaiting_assignment') && request.status !== 'cancelled';

              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestHeaderLeft}>
                      <FileText size={18} color={COLORS.primary} />
                      <Text style={styles.requestTitle}>
                        Toplam {totalRequested} Personel
                      </Text>
                    </View>
                    <View style={[styles.requestStatusBadge, { backgroundColor: statusColor.bg }]}>
                      <Text style={[styles.requestStatusText, { color: statusColor.text }]}>
                        {statusColor.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestDetails}>
                    {request.personnel_positions.map((pos: any, idx: number) => (
                      <View key={idx} style={styles.positionItem}>
                        <Text style={styles.positionLabel}>
                          {pos.personnel_type_name || pos.position || 'Belirtilmemiş'}
                        </Text>
                        <Text style={styles.positionQuantity}>
                          {pos.quantity || pos.count || 0} kişi
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.requestDateRow}>
                    <Calendar size={14} color={COLORS.textLight} />
                    <Text style={styles.requestDate}>
                      {new Date(request.created_at).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>

                  {request.rejection_reason && (
                    <View style={styles.rejectionReason}>
                      <Text style={styles.rejectionLabel}>Red Nedeni:</Text>
                      <Text style={styles.rejectionText}>{request.rejection_reason}</Text>
                    </View>
                  )}

                  {canEdit && (
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => router.push(`/manager/create-request?editId=${request.id}&projectId=${id}`)}
                      >
                        <Edit2 size={16} color={COLORS.primary} />
                        <Text style={styles.editButtonText}>Düzenle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelRequest(request.id)}
                      >
                        <Trash2 size={16} color="#dc2626" />
                        <Text style={styles.cancelButtonText}>İptal Et</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <Text style={styles.sectionTitle}>ATANAN PERSONEL ({personnel.length})</Text>

        {personnel.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>Bu projeye henüz personel atanmamış</Text>
          </View>
        ) : (
          personnel.map((person) => (
            <TouchableOpacity
              key={person.id}
              style={styles.personnelCard}
              onPress={() => {
                router.push(`/manager/personnel-attendance?personnelId=${person.id}&projectId=${id}`);
              }}
            >
              {person.avatar_url ? (
                <Image source={{ uri: person.avatar_url }} style={styles.personnelAvatar} />
              ) : (
                <View style={styles.personnelIcon}>
                  <User size={20} color={COLORS.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.personnelName}>{person.full_name}</Text>
                  {person.isWorking && (
                    <View style={styles.workingBadge}>
                      <Clock size={10} color={COLORS.success} />
                      <Text style={styles.workingText}>Mesaide</Text>
                    </View>
                  )}
                </View>
                {person.position && (
                  <Text style={styles.personnelPosition}>{person.position}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={qrModalVisible} transparent animationType="fade">
        <Pressable style={styles.qrModalOverlay} onPress={() => setQrModalVisible(false)}>
          <View style={styles.qrModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>{project?.name}</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {project?.qr_code_secret && (
              <View style={styles.qrCodeContainer}>
                <QRCode
                  value={project.qr_code_secret}
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

      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.cancelModalOverlay}>
          <View style={styles.cancelModalContent}>
            <View style={styles.cancelModalHeader}>
              <Text style={styles.cancelModalTitle}>Talebi İptal Et</Text>
            </View>
            <Text style={styles.cancelModalMessage}>
              Bu personel talebini iptal etmek istediğinizden emin misiniz? İptal edilen talep admin tarafından görülebilecektir.
            </Text>
            <View style={styles.cancelModalButtons}>
              <TouchableOpacity
                style={styles.cancelModalCancelButton}
                onPress={() => {
                  setCancelModalVisible(false);
                  setSelectedRequestId(null);
                }}
              >
                <Text style={styles.cancelModalCancelButtonText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelModalConfirmButton}
                onPress={confirmCancelRequest}
              >
                <Text style={styles.cancelModalConfirmButtonText}>İptal Et</Text>
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
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  addressText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 16,
    textTransform: 'uppercase',
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
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 12,
  },
  personnelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personnelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personnelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  personnelName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  personnelPosition: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  workingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  workingText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
  },
  statusBadgeHeader: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTextHeader: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.secondary,
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
  summarySection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 4,
  },
  requestCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  requestStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  requestStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  requestDetails: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  positionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  positionLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  positionQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  requestDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  requestDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  rejectionReason: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: '#dc2626',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary + '10',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cancelModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  cancelModalHeader: {
    marginBottom: 16,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    textAlign: 'center',
  },
  cancelModalMessage: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  cancelModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalCancelButton: {
    flex: 1,
    backgroundColor: COLORS.border,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  cancelModalConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});
