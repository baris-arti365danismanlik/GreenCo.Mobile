import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, CheckCircle, XCircle, Clock, User, Calendar, Building, Plus } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type PersonnelRequest = {
  id: string;
  project_id: string | null;
  project_name: string;
  project_start_date: string;
  project_end_date: string;
  is_new_project: boolean;
  city: string | null;
  district: string | null;
  project_manager_id: string | null;
  is_new_manager: boolean;
  manager_data: any;
  personnel_positions: any[];
  requested_by: string;
  status: string;
  notes: string | null;
  created_at: string;
  requester: { full_name: string };
};

export default function AdminPersonnelRequestsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<PersonnelRequest[]>([]);
  const [personnelTypes, setPersonnelTypes] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PersonnelRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  const loadRequests = async () => {
    try {
      const [requestsRes, typesRes] = await Promise.all([
        supabase
          .from('personnel_requests')
          .select(`
            *,
            requester:profiles!personnel_requests_requested_by_fkey(full_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('personnel_types')
          .select('id, name')
      ]);

      if (requestsRes.error) throw requestsRes.error;
      setRequests(requestsRes.data || []);

      if (typesRes.data) {
        const typesMap: { [key: string]: string } = {};
        typesRes.data.forEach(type => {
          typesMap[type.id] = type.name;
        });
        setPersonnelTypes(typesMap);
      }
    } catch (error) {
      console.error('Talep yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: PersonnelRequest) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Bu talebi onaylamak istediğinize emin misiniz?\n\nProje ve proje yöneticisi otomatik olarak oluşturulacak.')
      : true;

    if (!confirmed) return;

    setProcessingApproval(true);
    try {
      let projectId = request.project_id;
      let managerId = request.project_manager_id;
      let createdNewProject = false;
      let createdNewManager = false;

      if (request.is_new_project) {
        const { data: existingProject } = await supabase
          .from('projects_greenco')
          .select('id')
          .eq('name', request.project_name)
          .maybeSingle();

        if (existingProject) {
          projectId = existingProject.id;
        } else {
          const address = request.city && request.district
            ? `${request.district}, ${request.city}`
            : null;

          const { data: newProject, error: projectError } = await supabase
            .from('projects_greenco')
            .insert({
              name: request.project_name,
              address: address,
              start_date: request.project_start_date,
              end_date: request.project_end_date,
              is_active: true,
            })
            .select()
            .single();

          if (projectError) throw projectError;
          projectId = newProject.id;
          createdNewProject = true;
        }
      }

      if (request.is_new_manager && request.manager_data) {
        const cleanPhone = request.manager_data.phone.replace(/\D/g, '');

        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', cleanPhone)
          .eq('role', 'project_manager')
          .maybeSingle();

        if (existingUser) {
          managerId = existingUser.id;
        } else {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;

          if (!token) {
            throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
          }

          const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-user`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone: request.manager_data.phone,
              password: request.manager_data.password,
              full_name: request.manager_data.full_name,
              role: 'project_manager',
              service_modules: ['personnel'],
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Proje yöneticisi oluşturulamadı');
          }

          managerId = result.user_id;
          createdNewManager = true;
        }
      }

      if (projectId && managerId) {
        const { error: assignError } = await supabase
          .from('project_managers')
          .insert({
            project_id: projectId,
            manager_id: managerId,
          });

        if (assignError) {
          console.warn('Proje yöneticisi atama hatası:', assignError);
        }
      }

      const { error: updateError } = await supabase
        .from('personnel_requests')
        .update({
          status: 'awaiting_assignment',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          project_id: projectId,
          project_manager_id: managerId,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: request.requested_by,
        title: 'Personel Talebi Onaylandı',
        message: `${request.project_name} için personel talebiniz onaylandı.${createdNewProject ? ' Yeni proje oluşturuldu.' : ''}${createdNewManager ? ' Yeni proje yöneticisi oluşturuldu.' : ''}`,
        type: 'system',
      });

      if (Platform.OS === 'web') {
        let message = 'Başarılı! Talep onaylandı.';
        if (createdNewProject) message += '\n✓ Yeni proje oluşturuldu';
        if (createdNewManager) message += '\n✓ Yeni proje yöneticisi oluşturuldu';
        if (projectId && managerId) message += '\n✓ Proje yöneticisi atandı';
        message += '\n\nŞimdi personel ataması yapabilirsiniz.';
        window.alert(message);
      }

      router.push(`/admin/assign-personnel?requestId=${request.id}`);
    } catch (error: any) {
      console.error('Onaylama hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Onaylama başarısız'));
      }
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleRejectClick = (request: PersonnelRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen red nedenini yazın');
      }
      return;
    }

    if (!selectedRequest) return;

    try {
      const { error } = await supabase
        .from('personnel_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedRequest.requested_by,
        title: 'Personel Talebi Reddedildi',
        message: `${selectedRequest.project_name} için personel talebiniz reddedildi. Sebep: ${rejectionReason}`,
        type: 'system',
      });

      if (Platform.OS === 'web') {
        window.alert('Başarılı! Talep reddedildi.');
      }
      setRejectModalVisible(false);
      setSelectedRequest(null);
      setRejectionReason('');
      loadRequests();
    } catch (error: any) {
      console.error('Reddetme hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: ' + (error.message || 'Reddetme başarısız'));
      }
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Bekliyor', color: COLORS.warning, Icon: Clock };
      case 'awaiting_assignment':
        return { label: 'Atama Bekliyor', color: COLORS.warning, Icon: User };
      case 'completed':
        return { label: 'Tamamlandı', color: COLORS.success, Icon: CheckCircle };
      case 'approved':
        return { label: 'Onaylandı', color: COLORS.success, Icon: CheckCircle };
      case 'rejected':
        return { label: 'Reddedildi', color: COLORS.danger, Icon: XCircle };
      case 'cancelled':
        return { label: 'İptal Edildi', color: '#6b7280', Icon: XCircle };
      default:
        return { label: status, color: COLORS.textLight, Icon: Clock };
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const awaitingAssignmentRequests = requests.filter(r => r.status === 'awaiting_assignment');
  const completedRequests = requests.filter(r => r.status === 'completed' || r.status === 'approved');
  const cancelledRequests = requests.filter(r => r.status === 'cancelled');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personel Talepleri</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/admin/create-project?title=Personel Talebi Oluştur&mode=request')}
        >
          <Plus size={24} color="white" />
          <Text style={styles.createButtonText}>Yeni Talep Oluştur</Text>
        </TouchableOpacity>

        {loading ? (
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  BEKLEYEN TALEPLER ({pendingRequests.length})
                </Text>
                {pendingRequests.map((request) => {
                  const statusConfig = getStatusConfig(request.status);
                  const StatusIcon = statusConfig.Icon;
                  const totalPersonnel = request.personnel_positions.reduce((sum: number, p: any) => sum + (p.count || 0), 0);

                  return (
                    <View key={request.id} style={[styles.requestCard, styles.pendingCard]}>
                      <View style={styles.requestHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Text style={styles.projectName}>{request.project_name}</Text>
                            {request.is_new_project && (
                              <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>YENİ</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Building size={14} color={COLORS.textLight} />
                            <Text style={styles.projectDates}>
                              {new Date(request.project_start_date).toLocaleDateString('tr-TR')} - {new Date(request.project_end_date).toLocaleDateString('tr-TR')}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                          <StatusIcon size={14} color={statusConfig.color} />
                          <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.requestInfo}>
                        <View style={styles.infoCard}>
                          <Text style={styles.infoCardTitle}>Proje Yöneticisi</Text>
                          {request.is_new_manager && request.manager_data ? (
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                <Text style={styles.infoCardValue}>{request.manager_data.full_name}</Text>
                                <View style={styles.newBadge}>
                                  <Text style={styles.newBadgeText}>YENİ</Text>
                                </View>
                              </View>
                              <Text style={styles.infoCardSubtext}>{request.manager_data.phone}</Text>
                            </View>
                          ) : (
                            <Text style={styles.infoCardValue}>Mevcut yönetici</Text>
                          )}
                        </View>

                        <View style={styles.infoCard}>
                          <Text style={styles.infoCardTitle}>Talep Eden</Text>
                          <Text style={styles.infoCardValue}>{request.requester?.full_name || 'Bilinmiyor'}</Text>
                        </View>

                        <View style={styles.personnelSection}>
                          <Text style={styles.personnelTitle}>
                            Talep Edilen Personel (Toplam: {totalPersonnel})
                          </Text>
                          {request.personnel_positions.map((position: any, idx: number) => (
                            <View key={idx} style={styles.personnelItem}>
                              <View style={styles.personnelRow}>
                                <User size={16} color={COLORS.primary} />
                                <Text style={styles.personnelText}>
                                  {position.count}x {personnelTypes[position.personnel_type_id] || position.type || 'Bilinmiyor'}
                                </Text>
                              </View>
                              <Text style={styles.personnelDetail}>
                                Sabıka: {position.criminal_record || 'Belirtilmemiş'}
                              </Text>
                              {position.certificates && position.certificates.length > 0 && (
                                <Text style={styles.personnelDetail}>
                                  Sertifikalar: {position.certificates.join(', ')}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>

                        {request.notes && (
                          <Text style={styles.notesText}>Not: {request.notes}</Text>
                        )}
                      </View>

                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleRejectClick(request)}
                          disabled={processingApproval}
                        >
                          <XCircle size={18} color={COLORS.danger} />
                          <Text style={styles.rejectButtonText}>Reddet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.approveButton, processingApproval && styles.approveButtonDisabled]}
                          onPress={() => handleApprove(request)}
                          disabled={processingApproval}
                        >
                          <CheckCircle size={18} color="white" />
                          <Text style={styles.approveButtonText}>
                            {processingApproval ? 'İşleniyor...' : 'Onayla'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {awaitingAssignmentRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                  PERSONEL ATAMASI BEKLEYENLER ({awaitingAssignmentRequests.length})
                </Text>
                {awaitingAssignmentRequests.map((request) => {
                  const totalPersonnel = request.personnel_positions.reduce((sum: number, p: any) => sum + (p.count || 0), 0);

                  return (
                    <View key={request.id} style={[styles.requestCard, styles.awaitingCard]}>
                      <View style={styles.requestHeader}>
                        <Text style={styles.projectName}>{request.project_name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: COLORS.warning + '20' }]}>
                          <Clock size={14} color={COLORS.warning} />
                          <Text style={[styles.statusText, { color: COLORS.warning }]}>
                            Atama Bekliyor
                          </Text>
                        </View>
                      </View>

                      <View style={styles.requestDetails}>
                        <Text style={styles.detailText}>
                          Toplam {totalPersonnel} personel ataması bekleniyor
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.assignButton}
                        onPress={() => router.push(`/admin/assign-personnel?requestId=${request.id}`)}
                      >
                        <User size={18} color="white" />
                        <Text style={styles.assignButtonText}>Personel Ata</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            {completedRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                  TAMAMLANAN TALEPLER ({completedRequests.length})
                </Text>
                {completedRequests.map((request) => {
                  const statusConfig = getStatusConfig(request.status);
                  const StatusIcon = statusConfig.Icon;

                  return (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <Text style={styles.projectName}>{request.project_name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                          <StatusIcon size={14} color={statusConfig.color} />
                          <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {cancelledRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                  İPTAL EDİLEN TALEPLER ({cancelledRequests.length})
                </Text>
                {cancelledRequests.map((request) => {
                  const statusConfig = getStatusConfig(request.status);
                  const StatusIcon = statusConfig.Icon;

                  return (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <Text style={styles.projectName}>{request.project_name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: '#f3f4f6' }]}>
                          <StatusIcon size={14} color={statusConfig.color} />
                          <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.requestDetails}>
                        <Text style={styles.detailText}>
                          {request.requester?.full_name} tarafından {new Date(request.created_at).toLocaleDateString('tr-TR')} tarihinde oluşturuldu
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {rejectedRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                  REDDEDİLEN TALEPLER ({rejectedRequests.length})
                </Text>
                {rejectedRequests.map((request) => {
                  const statusConfig = getStatusConfig(request.status);
                  const StatusIcon = statusConfig.Icon;

                  return (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <Text style={styles.projectName}>{request.project_name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                          <StatusIcon size={14} color={statusConfig.color} />
                          <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.requestDetails}>
                        <Text style={styles.detailText}>
                          {request.requester?.full_name} tarafından {new Date(request.created_at).toLocaleDateString('tr-TR')} tarihinde oluşturuldu
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {requests.length === 0 && (
              <View style={styles.emptyState}>
                <Clock size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>Henüz talep bulunmuyor</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Talep Red Nedeni</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Red nedenini yazın..."
              multiline
              numberOfLines={4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalRejectButton}
                onPress={handleRejectSubmit}
              >
                <Text style={styles.modalRejectText}>Reddet</Text>
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
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  createButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    elevation: 2,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
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
  requestCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  projectDates: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  newBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestInfo: {
    gap: 12,
  },
  infoCard: {
    backgroundColor: COLORS.bg,
    padding: 12,
    borderRadius: 8,
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  infoCardSubtext: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  personnelSection: {
    backgroundColor: COLORS.bg,
    padding: 12,
    borderRadius: 8,
  },
  personnelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  personnelItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '40',
  },
  personnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  personnelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  personnelDetail: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 24,
  },
  notesText: {
    fontSize: 13,
    color: COLORS.text,
    fontStyle: 'italic',
    backgroundColor: COLORS.bg,
    padding: 12,
    borderRadius: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.success,
  },
  approveButtonDisabled: {
    opacity: 0.5,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  awaitingCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  assignButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  assignButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  requestDetails: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  modalRejectButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
  },
  modalRejectText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
