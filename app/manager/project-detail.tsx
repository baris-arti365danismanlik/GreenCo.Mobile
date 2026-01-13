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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Clock, MapPin, Power, RefreshCw, QrCode, Eye, Users, FileText, Edit2, Trash2, Calendar, User, Phone, CheckCircle, X, Star, ChevronDown, ChevronUp } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';

type Personnel = {
  id: string;
  full_name: string;
  position: string | null;
  is_active: boolean;
  isWorking?: boolean;
  avatar_url?: string;
  averageRating?: number;
  ratingCount?: number;
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
  team_id?: string | null;
  team_name?: string | null;
};

type ProjectTeam = {
  id: string;
  name: string;
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
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [newLocation, setNewLocation] = useState<{ lat: number, lon: number, address: string } | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLon, setEditLon] = useState('');

  // Team Support
  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<{ [key: string]: boolean }>({});

  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

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
            .gte('check_in_time', todayStart.toISOString());

          const location = [p.city, p.district].filter(Boolean).join(' / ') || null;

          // Check if ANY record has no check_out_time
          const isWorking = todayAttendance?.some(r => r.check_in_time && !r.check_out_time);

          return {
            id: p.id,
            full_name: p.full_name,
            position: p.personnel_types?.name || null,
            is_active: p.is_active,
            user_id: p.id,
            location: location,
            isWorking: isWorking,
            avatar_url: p.avatar_url,
          };
        })
      );

      setPersonnel(personnelWithStatus);

      // Fetch ratings for each personnel in this project
      const { data: attendanceRatings } = await supabase
        .from('attendance_records')
        .select('worker_id, performance_rating')
        .eq('project_id', id)
        .not('performance_rating', 'is', null);

      if (attendanceRatings && attendanceRatings.length > 0) {
        // Group ratings by worker
        const ratingsMap = new Map(); // worker_id -> { total: number, count: number }

        attendanceRatings.forEach(record => {
          if (!record.performance_rating) return;

          if (!ratingsMap.has(record.worker_id)) {
            ratingsMap.set(record.worker_id, { total: 0, count: 0 });
          }

          const stats = ratingsMap.get(record.worker_id);
          stats.total += record.performance_rating;
          stats.count += 1;
        });

        // Update personnel with average rating
        const personnelWithRatings = personnelWithStatus.map(p => {
          const stats = ratingsMap.get(p.id);
          return {
            ...p,
            averageRating: stats ? (stats.total / stats.count) : undefined,
            ratingCount: stats ? stats.count : 0
          };
        });

        setPersonnel(personnelWithRatings);
      }
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

      // Fetch team names
      const { data: teamsData, error: teamsError } = await supabase
        .from('project_teams')
        .select('id, name')
        .eq('project_id', id);

      if (teamsError) console.error('Error fetching teams:', teamsError);

      const loadedTeams = teamsData || [];
      setTeams(loadedTeams);

      // Initialize all teams as expanded by default
      const initialExpandedState: { [key: string]: boolean } = {};
      loadedTeams.forEach(t => initialExpandedState[t.id] = true);
      initialExpandedState['general'] = true; // For requests without team
      setExpandedTeams(initialExpandedState);

      const teamMap = new Map(loadedTeams.map(t => [t.id, t.name]));

      // Add personnel_type_name to each position
      const enrichedData = (data || []).map(request => ({
        ...request,
        team_name: request.team_id ? teamMap.get(request.team_id) : null,
        // Don't override team_id, just use it
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

  const handleUpdateLocation = async () => {
    if (!project) return;

    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Konum izni verilmedi. Lütfen tarayıcı ayarlarından (adres çubuğundaki kilit/konum ikonu) konum iznini aktif edip sayfayı yenileyin.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      let addressText = 'Adres alınamadı';
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        if (reverseGeocode.length > 0) {
          const addr = reverseGeocode[0];
          const parts = [addr.street, addr.district, addr.city, addr.region].filter(Boolean);
          addressText = parts.join(', ');
        }
      } catch (e) {
        console.log('Reverse geocode error', e);
      }

      setNewLocation({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        address: addressText
      });
      setEditLat(location.coords.latitude.toString());
      setEditLon(location.coords.longitude.toString());
      setLocationModalVisible(true);
    } catch (error: any) {
      console.error('Konum alma hatası:', error);
      alert('Konum alınamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmUpdateLocation = async () => {
    if (!project) return;

    // Parse values
    const lat = parseFloat(editLat);
    const lon = parseFloat(editLon);

    if (isNaN(lat) || isNaN(lon)) {
      alert('Lütfen geçerli bir enlem ve boylam değeri giriniz.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects_greenco')
        .update({
          latitude: lat,
          longitude: lon,
        })
        .eq('id', project.id);

      if (error) throw error;

      alert('Başarılı! Proje konumu güncellendi.');
      setLocationModalVisible(false);
      loadProject();
    } catch (error: any) {
      console.error('Konum güncelleme hatası:', error);
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
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
            {project.qr_code_secret && (
              <TouchableOpacity
                style={styles.qrButtonSecondary}
                onPress={handleUpdateLocation}
              >
                <MapPin size={18} color={COLORS.primary} />
                <Text style={styles.qrButtonSecondaryText}>Konum</Text>
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

            {(() => {
              // Group logic
              const requestsByTeam: { [key: string]: PersonnelRequest[] } = {};
              const noTeamRequests: PersonnelRequest[] = [];

              personnelRequests.forEach(req => {
                if (req.team_id) {
                  if (!requestsByTeam[req.team_id]) requestsByTeam[req.team_id] = [];
                  requestsByTeam[req.team_id].push(req);
                } else {
                  noTeamRequests.push(req);
                }
              });

              const renderRequestCard = (request: PersonnelRequest) => {
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
                const canEdit = request.status === 'pending' || request.status === 'awaiting_assignment';

                return (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <View style={styles.requestHeaderLeft}>
                        <FileText size={18} color={COLORS.primary} />
                        <View>
                          {request.title && (
                            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.secondary, marginBottom: 2 }}>
                              {request.title}
                            </Text>
                          )}
                          <Text style={styles.requestTitle}>
                            Toplam {totalRequested} Personel
                          </Text>
                        </View>
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
              };

              return (
                <View style={{ gap: 12 }}>
                  {/* Teams Accordions */}
                  {Object.keys(requestsByTeam).map(teamId => {
                    const teamName = teams.find(t => t.id === teamId)?.name || 'Bilinmeyen Ekip';
                    const isExpanded = expandedTeams[teamId];
                    const requests = requestsByTeam[teamId];

                    return (
                      <View key={teamId} style={{ backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 16,
                            backgroundColor: '#f8fafc'
                          }}
                          onPress={() => toggleTeamExpand(teamId)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Users size={20} color={COLORS.primary} />
                            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.secondary }}>{teamName}</Text>
                            <View style={{ backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                              <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>{requests.length} Talep</Text>
                            </View>
                          </View>
                          {isExpanded ? <ChevronUp size={20} color={COLORS.textLight} /> : <ChevronDown size={20} color={COLORS.textLight} />}
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={{ padding: 12, gap: 12 }}>
                            {requests.map(renderRequestCard)}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* General / No Team Requests */}
                  {noTeamRequests.length > 0 && (
                    <View style={{ backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 16,
                          backgroundColor: '#f8fafc'
                        }}
                        onPress={() => toggleTeamExpand('general')}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <FileText size={20} color={COLORS.textLight} />
                          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.secondary }}>Genel (Takımsız)</Text>
                          <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                            <Text style={{ fontSize: 12, color: COLORS.textLight, fontWeight: '600' }}>{noTeamRequests.length} Talep</Text>
                          </View>
                        </View>
                        {expandedTeams['general'] ? <ChevronUp size={20} color={COLORS.textLight} /> : <ChevronDown size={20} color={COLORS.textLight} />}
                      </TouchableOpacity>

                      {expandedTeams['general'] && (
                        <View style={{ padding: 12, gap: 12 }}>
                          {noTeamRequests.map(renderRequestCard)}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );

            })()}
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

                {/* Average Rating Display */}
                {person.averageRating !== undefined && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <Star size={12} color="#fbbf24" fill="#fbbf24" />
                    <Text style={{ fontSize: 12, color: COLORS.text, fontWeight: '600' }}>
                      {person.averageRating.toFixed(1)}
                    </Text>
                    <Text style={{ fontSize: 10, color: COLORS.textLight }}>
                      ({person.ratingCount} değerlendirme)
                    </Text>
                  </View>
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

      <Modal visible={locationModalVisible} transparent animationType="fade">
        <View style={styles.cancelModalOverlay}>
          <View style={styles.cancelModalContent}>
            <View style={styles.cancelModalHeader}>
              <Text style={styles.cancelModalTitle}>Konum Güncelleme</Text>
            </View>
            <View style={{ marginBottom: 20 }}>

              <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 16, lineHeight: 18 }}>
                Aşağıdaki koordinatları manuel olarak düzenleyebilirsiniz (Google Maps vb. kaynaklardan alınan değerler).
              </Text>

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginBottom: 6 }}>Enlem (Latitude):</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text }}
                  value={editLat}
                  onChangeText={setEditLat}
                  keyboardType="numeric"
                  placeholder="Örn: 41.0082"
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginBottom: 6 }}>Boylam (Longitude):</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text }}
                  value={editLon}
                  onChangeText={setEditLon}
                  keyboardType="numeric"
                  placeholder="Örn: 28.9784"
                />
              </View>

              {newLocation?.address && newLocation.address !== 'Adres alınamadı' && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f9fafb', padding: 10, borderRadius: 8 }}>
                  <MapPin size={16} color={COLORS.textLight} style={{ marginTop: 2, marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: COLORS.secondary, fontSize: 12 }}>Algılanan Adres:</Text>
                    <Text style={{ color: COLORS.textLight, marginTop: 2, fontSize: 12 }}>
                      {newLocation.address}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                      (Manuel koordinat değişikliği adresi etkilemez)
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <Text style={[styles.cancelModalMessage, { marginBottom: 16 }]}>
              Proje konumu girilen değerler ile güncellenecektir. Onaylıyor musunuz?
            </Text>
            <View style={styles.cancelModalButtons}>
              <TouchableOpacity
                style={styles.cancelModalCancelButton}
                onPress={() => setLocationModalVisible(false)}
              >
                <Text style={styles.cancelModalCancelButtonText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelModalConfirmButton}
                onPress={confirmUpdateLocation}
              >
                <Text style={styles.cancelModalConfirmButtonText}>Onayla ve Güncelle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
