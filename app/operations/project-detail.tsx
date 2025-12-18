import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, MapPin, Calendar, User, Clock, FileText, XCircle, Users, Edit2, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Project = {
  id: string;
  name: string;
  address?: string;
  status: string;
  request_status?: string;
  requested_personnel?: number;
  assigned_personnel?: number;
  start_date?: string;
  end_date?: string;
};

type Personnel = {
  id: string;
  full_name: string;
  avatar_url?: string;
  personnel_type?: string;
  attendance_count: number;
  total_hours: number;
  isWorking: boolean;
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

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Onay Bekliyor',
  approved: 'Onaylandı',
  awaiting_assignment: 'Atama Bekleniyor',
  completed: 'Tamamlandı',
  rejected: 'Reddedildi',
};

const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: COLORS.amber,
  approved: COLORS.blue,
  awaiting_assignment: COLORS.primary,
  completed: COLORS.success,
  rejected: '#ef4444',
};

export default function OperationsProjectDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [personnelRequests, setPersonnelRequests] = useState<PersonnelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  useEffect(() => {
    loadProjectData();
    loadPersonnelRequests();
  }, [projectId]);

  // Sayfa odaklandığında (edit'ten geri döndüğünde) verileri yenile
  useFocusEffect(
    useCallback(() => {
      if (projectId) {
        loadPersonnelRequests();
      }
    }, [projectId])
  );

  const loadProjectData = async () => {
    try {
      setLoading(true);

      const { data: projectData, error: projectError } = await supabase
        .from('projects_greenco')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!projectData) return;

      const { data: assignments, error: assignmentsError } = await supabase
        .from('project_assignments')
        .select('personnel_id')
        .eq('project_id', projectId)
        .is('removed_at', null);

      if (assignmentsError) throw assignmentsError;

      const assignedCount = assignments?.length || 0;

      setProject({
        ...projectData,
        assigned_personnel: assignedCount,
      });

      const personnelIds = assignments?.map(a => a.personnel_id) || [];

      if (personnelIds.length === 0) {
        setPersonnel([]);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          avatar_url,
          personnel_types (
            name
          )
        `)
        .in('id', personnelIds);

      if (profilesError) throw profilesError;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const personnelWithStats = await Promise.all(
        (profilesData || []).map(async (person) => {
          const { count: attendanceCount } = await supabase
            .from('attendance_records')
            .select('*', { count: 'exact', head: true })
            .eq('worker_id', person.id)
            .eq('project_id', projectId);

          const { data: hoursData } = await supabase
            .from('attendance_records')
            .select('total_hours')
            .eq('worker_id', person.id)
            .eq('project_id', projectId)
            .not('total_hours', 'is', null);

          const totalHours = hoursData?.reduce((sum, record) => sum + (Number(record.total_hours) || 0), 0) || 0;

          const { data: todayAttendance } = await supabase
            .from('attendance_records')
            .select('check_in_time, check_out_time')
            .eq('worker_id', person.id)
            .eq('project_id', projectId)
            .gte('check_in_time', todayStart.toISOString())
            .maybeSingle();

          const isWorking = todayAttendance && todayAttendance.check_in_time && !todayAttendance.check_out_time;

          return {
            id: person.id,
            full_name: person.full_name,
            avatar_url: person.avatar_url,
            personnel_type: (person.personnel_types as any)?.name || undefined,
            attendance_count: attendanceCount || 0,
            total_hours: Math.round(totalHours * 10) / 10,
            isWorking: isWorking || false,
          };
        })
      );

      personnelWithStats.sort((a, b) => b.attendance_count - a.attendance_count);

      setPersonnel(personnelWithStats);
    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPersonnelRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('personnel_requests')
        .select('*')
        .eq('project_id', projectId)
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Proje Detayı</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Proje Detayı</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Proje bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proje Detayı</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.projectCard}>
          <View style={styles.projectHeader}>
            <Text style={styles.projectName}>{project.name}</Text>
            {project.request_status && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: REQUEST_STATUS_COLORS[project.request_status] + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: REQUEST_STATUS_COLORS[project.request_status] },
                  ]}
                >
                  {REQUEST_STATUS_LABELS[project.request_status] || project.request_status}
                </Text>
              </View>
            )}
          </View>

          {project.address && (
            <View style={styles.projectInfo}>
              <MapPin size={16} color={COLORS.textLight} />
              <Text style={styles.projectInfoText}>
                {project.address}
              </Text>
            </View>
          )}

          {(project.start_date || project.end_date) && (
            <View style={styles.projectInfo}>
              <Calendar size={16} color={COLORS.textLight} />
              <Text style={styles.projectInfoText}>
                {formatDate(project.start_date)} - {formatDate(project.end_date)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <Users size={20} color={COLORS.primary} />
            <Text style={styles.summaryLabel}>Atanan Personel</Text>
            <Text style={styles.summaryValue}>{project.assigned_personnel || 0}</Text>
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

              // Operations kullanıcısı pending ve awaiting_assignment taleplerini düzenleyebilir ve iptal edebilir
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
                        onPress={() => router.push(`/operations/create-request?editId=${request.id}&projectId=${projectId}`)}
                      >
                        <Edit2 size={16} color={COLORS.primary} />
                        <Text style={styles.editButtonText}>Düzenle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelRequest(request.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                        <Text style={styles.cancelButtonText}>İptal Et</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <Text style={styles.sectionTitle}>ATANAN PERSONEL VE DEVAM DURUMU</Text>

        {personnel.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Henüz personel atanmamış</Text>
          </View>
        ) : (
          personnel.map((person) => (
            <View key={person.id} style={styles.personnelCard}>
              <View style={styles.personnelHeader}>
                <View style={styles.avatarContainer}>
                  {person.avatar_url ? (
                    <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <User size={24} color="white" />
                    </View>
                  )}
                  {person.isWorking && <View style={styles.workingIndicator} />}
                </View>

                <View style={styles.personnelInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.personnelName}>{person.full_name}</Text>
                    {person.isWorking && (
                      <View style={styles.workingBadge}>
                        <Clock size={10} color={COLORS.success} />
                        <Text style={styles.workingText}>Mesaide</Text>
                      </View>
                    )}
                  </View>
                  {person.personnel_type && (
                    <Text style={styles.personnelType}>{person.personnel_type}</Text>
                  )}
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{person.attendance_count}</Text>
                  <Text style={styles.statLabel}>Devam Günü</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{person.total_hours}h</Text>
                  <Text style={styles.statLabel}>Toplam Saat</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  projectCard: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  projectInfoText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 12,
    marginTop: 16,
    marginHorizontal: 20,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  summarySection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
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
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
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
    marginBottom: 8,
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
  emptyBox: {
    backgroundColor: 'white',
    padding: 40,
    alignItems: 'center',
  },
  personnelCard: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 1,
  },
  personnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workingIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: 'white',
  },
  personnelInfo: {
    flex: 1,
  },
  personnelName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  personnelType: {
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
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
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
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cancelModalHeader: {
    marginBottom: 16,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  cancelModalMessage: {
    fontSize: 16,
    color: COLORS.textLight,
    lineHeight: 24,
    marginBottom: 24,
  },
  cancelModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  cancelModalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
