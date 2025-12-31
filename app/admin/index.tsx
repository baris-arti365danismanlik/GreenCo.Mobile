import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  LogOut, Building, User, Send, Users, UserCheck, X, CheckCircle,
  ClipboardList, FolderKanban, BarChart3, ArrowLeft, DollarSign,
  FileText, Search as SearchIcon
} from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';
import { DateRangePicker } from '@/components/DateRangePicker';

export default function AdminScreen() {
  const router = useRouter();
  const { signOut, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [step, setStep] = useState<'project' | 'period'>('project');
  const [disabledRanges, setDisabledRanges] = useState<{ start: string; end: string }[]>([]);
  const [stats, setStats] = useState({
    activeProjects: 0,
    totalPersonnel: 0,
    workingToday: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProjects();
    loadStats();
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('Admin screen focused, reloading stats...');
      loadStats();
    }, [])
  );

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects_greenco')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Proje yükleme hatası:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { count: projectCount } = await supabase
        .from('projects_greenco')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: personnelCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'personnel');

      console.log('Personnel count query result:', personnelCount);

      const today = new Date().toISOString().split('T')[0];

      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('worker_id, check_in_time, check_out_time, shifts!inner(shift_date)')
        .eq('shifts.shift_date', today);

      const workingToday = new Set(
        (attendanceRecords || [])
          .filter(record => record.check_in_time && !record.check_out_time)
          .map(record => record.worker_id)
      ).size;

      const newStats = {
        activeProjects: projectCount || 0,
        totalPersonnel: personnelCount || 0,
        workingToday,
      };

      console.log('Setting stats:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Sign out error:', error);
      router.replace('/(auth)/sign-in');
    }
  };

  const handleOpenModal = () => {
    setModalVisible(true);
    setStep('project');
    setSelectedProject(null);
    setPeriodStart('');
    setPeriodEnd('');
  };

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProject(projectId);

    const { data: approvedPeriods } = await supabase
      .from('timesheet_periods')
      .select('period_start, period_end')
      .eq('project_id', projectId)
      .in('status', ['approved_manager', 'final_approved']);

    setDisabledRanges(
      approvedPeriods?.map(p => ({ start: p.period_start, end: p.period_end })) || []
    );

    setStep('period');
  };

  const handleSubmitTimesheet = async () => {
    if (!selectedProject || !periodStart || !periodEnd) {
      Alert.alert('Uyarı', 'Lütfen tüm alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      const { data: existingPeriod } = await supabase
        .from('timesheet_periods')
        .select('id')
        .eq('project_id', selectedProject)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle();

      if (existingPeriod) {
        Alert.alert('Uyarı', 'Bu proje ve dönem için zaten puantaj oluşturulmuş.');
        setLoading(false);
        return;
      }

      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('total_hours, worker_id')
        .eq('project_id', selectedProject)
        .gte('check_in_time', `${periodStart}T00:00:00`)
        .lte('check_in_time', `${periodEnd}T23:59:59`);

      const totalHours = attendanceData?.reduce((sum, record) => sum + (Number(record.total_hours) || 0), 0) || 0;
      const uniqueWorkers = new Set(attendanceData?.map(r => r.worker_id) || []).size;

      const { data: projectManagers } = await supabase
        .from('project_managers')
        .select('manager_id, manager:profiles(id, full_name)')
        .eq('project_id', selectedProject);

      const { error: insertError } = await supabase
        .from('timesheet_periods')
        .insert({
          project_id: selectedProject,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'pending_manager',
          initiated_by: profile?.id,
          total_hours: totalHours,
          total_personnel: uniqueWorkers,
        });

      if (insertError) throw insertError;

      if (projectManagers && projectManagers.length > 0) {
        const notifications = projectManagers.map(pm => ({
          user_id: pm.manager_id,
          title: 'Yeni Puantaj Onayı',
          message: `Yeni bir puantaj dönemi (${periodStart} - ${periodEnd}) onayınızı bekliyor.`,
          type: 'system',
        }));
        await supabase.from('notifications').insert(notifications);
      }

      Alert.alert('Başarılı', `Puantaj dönemi oluşturuldu ve ${projectManagers?.length || 0} proje yöneticisine gönderildi.`);
      setModalVisible(false);
      setSelectedProject(null);
      setPeriodStart('');
      setPeriodEnd('');
      setStep('project');
    } catch (error: any) {
      console.error('Puantaj oluşturma hatası:', error);
      Alert.alert('Hata', error.message || 'Puantaj oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Paneli</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <LogOut size={24} color={COLORS.text} />
        </TouchableOpacity>

      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => router.push('/admin/dashboard')}
        >
          <BarChart3 size={28} color="white" />
          <View style={{ flex: 1 }}>
            <Text style={styles.dashboardButtonTitle}>Dashboard</Text>
            <Text style={styles.dashboardButtonSub}>Detaylı istatistikleri görüntüle</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>HIZLI İŞLEMLER</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => router.push('/admin/companies')}
          >
            <Building size={24} color={COLORS.purple} />
            <Text style={styles.adminCardText}>Firma Yönetimi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => router.push('/admin/users')}
          >
            <Users size={24} color={COLORS.blue} />
            <Text style={styles.adminCardText}>Kullanıcı Yönetimi</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 20 }}>
          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => router.push('/admin/create-project')}
          >
            <FolderKanban size={24} color={COLORS.success} />
            <Text style={styles.adminCardText}>Yeni Proje Oluştur</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.primary }]}
          onPress={() => router.push('/admin/projects')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FolderKanban size={24} color={COLORS.primary} />
            <View>
              <Text style={styles.cardTitle}>Proje Yöneticileri</Text>
              <Text style={styles.cardSub}>Yönetici ata/kaldır</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.blue }]}
          onPress={() => router.push('/admin/personnel')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <UserCheck size={24} color={COLORS.blue} />
            <View>
              <Text style={styles.cardTitle}>Personel Detayları</Text>
              <Text style={styles.cardSub}>Tam profil görüntüleme</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.warning }]}
          onPress={handleOpenModal}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Send size={24} color={COLORS.warning} />
            <View>
              <Text style={styles.cardTitle}>Puantaj Başlat</Text>
              <Text style={styles.cardSub}>Dönemsel onay gönder</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.blue }]}
          onPress={() => router.push('/admin/timesheets')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <UserCheck size={24} color={COLORS.blue} />
            <View>
              <Text style={styles.cardTitle}>Puantaj Durumları</Text>
              <Text style={styles.cardSub}>Onay durumlarını görüntüle</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.success }]}
          onPress={() => router.push('/admin/personnel-requests')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={24} color={COLORS.success} />
            <View>
              <Text style={styles.cardTitle}>Personel Talepleri</Text>
              <Text style={styles.cardSub}>Bekleyen talepleri onayla</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.primary }]}
          onPress={() => router.push('/admin/project-personnel')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Users size={24} color={COLORS.primary} />
            <View>
              <Text style={styles.cardTitle}>Proje Personelleri</Text>
              <Text style={styles.cardSub}>Personel atamalarını yönet</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.warning }]}
          onPress={() => router.push('/admin/invoices')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FolderKanban size={24} color={COLORS.warning} />
            <View>
              <Text style={styles.cardTitle}>Hakediş Kayıtları</Text>
              <Text style={styles.cardSub}>Gelen hakedeşleri görüntüle</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>BİRİM BAZLI İŞ SİSTEMİ</Text>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#8b5cf6' }]}
          onPress={() => router.push('/admin/unit-work-orders')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={24} color="#8b5cf6" />
            <View>
              <Text style={styles.cardTitle}>İş Emirleri</Text>
              <Text style={styles.cardSub}>Onayla ve fiyatlandır</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.success }]}
          onPress={() => router.push('/admin/unit-invoices')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FileText size={24} color={COLORS.success} />
            <View>
              <Text style={styles.cardTitle}>Birim Bazlı Hakedişler</Text>
              <Text style={styles.cardSub}>Oluştur ve yönet</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#f59e0b' }]}
          onPress={() => router.push('/admin/create-unit-invoice')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <DollarSign size={24} color="#f59e0b" />
            <View>
              <Text style={styles.cardTitle}>Yeni Hakediş Oluştur</Text>
              <Text style={styles.cardSub}>İş emrinden hakediş çıkart</Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {step === 'project' ? 'Proje Seçin' : 'Dönem Belirleyin'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {step === 'project' && (
              <>
                <View style={styles.searchBox}>
                  <SearchIcon size={20} color={COLORS.textLight} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Proje ara..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <ScrollView style={styles.modalBody}>
                  {projects
                    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((project) => (
                      <TouchableOpacity
                        key={project.id}
                        style={styles.projectItem}
                        onPress={() => handleProjectSelect(project.id)}
                      >
                        <Building size={20} color={COLORS.primary} />
                        <Text style={styles.projectName}>{project.name}</Text>
                      </TouchableOpacity>
                    ))}
                  {projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <Text style={{ textAlign: 'center', color: COLORS.textLight, marginTop: 20 }}>
                      Proje bulunamadı
                    </Text>
                  )}
                </ScrollView>
              </>
            )}

            {step === 'period' && (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                <DateRangePicker
                  startDate={periodStart}
                  endDate={periodEnd}
                  onStartDateChange={setPeriodStart}
                  onEndDateChange={setPeriodEnd}
                  disabledRanges={disabledRanges}
                />

                {disabledRanges.length > 0 && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      Bu proje için {disabledRanges.length} onaylanmış dönem var. Bu dönemlere çakışan tarih seçemezsiniz.
                    </Text>
                  </View>
                )}

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setStep('project')}
                  >
                    <Text style={styles.backButtonText}>Geri</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitButton, loading && { opacity: 0.5 }]}
                    onPress={handleSubmitTimesheet}
                    disabled={loading}
                  >
                    <CheckCircle size={18} color="white" />
                    <Text style={styles.submitButtonText}>
                      {loading ? 'Gönderiliyor...' : 'Gönder'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  adminCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 100,
  },
  adminCardText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
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
  infoCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusLabel: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  statusValue: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
  dashboardButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    gap: 15,
    elevation: 3,
  },
  dashboardButtonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  dashboardButtonSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
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
  modalBody: {
    padding: 20,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    marginBottom: 10,
  },
  projectName: {
    fontSize: 16,
    color: COLORS.secondary,
    marginLeft: 10,
    fontWeight: '600',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 5,
    fontWeight: '600',
  },
  dateInput: {
    fontSize: 16,
    color: COLORS.secondary,
    padding: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  backButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  backButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  submitButton: {
    flex: 2,
    padding: 15,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: COLORS.warning + '20',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.text,
  },
});
