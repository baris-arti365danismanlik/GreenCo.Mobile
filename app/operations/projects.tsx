import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Users, Calendar, Clock } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Alert } from 'react-native';

type Project = {
  id: string;
  name: string;
  address?: string;
  status: string;
  request_status: string;
  start_date?: string;
  end_date?: string;
  assigned_personnel: number;
  attendance_days: number;
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

export default function OperationsProjectsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const serviceModules = (profile as any)?.service_modules || [];
    const hasPersonnel = serviceModules.includes('personnel');

    if (profile && !hasPersonnel) {
      Alert.alert('Yetkisiz Erişim', 'Bu sayfaya erişim yetkiniz yok.', [
        { text: 'Tamam', onPress: () => router.replace('/(auth)/role-select') }
      ]);
      return;
    }

    loadProjects();
  }, [profile]);

  const loadProjects = async () => {
    try {
      setLoading(true);

      const { data: requests, error: requestsError } = await supabase
        .from('personnel_requests')
        .select('project_id, status, personnel_positions, created_at')
        .eq('requested_by', user?.id)
        .not('project_id', 'is', null)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (!requests || requests.length === 0) {
        setProjects([]);
        return;
      }

      const projectMap = new Map<string, { status: string }>();
      requests.forEach(req => {
        if (req.project_id && !projectMap.has(req.project_id)) {
          projectMap.set(req.project_id, { status: req.status });
        }
      });

      const projectIds = Array.from(projectMap.keys());

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects_greenco')
        .select(`
          id,
          name,
          address,
          status,
          start_date,
          end_date
        `)
        .in('id', projectIds);

      if (projectsError) throw projectsError;

      const projectsWithStats = await Promise.all(
        (projectsData || []).map(async (project) => {
          const projectInfo = projectMap.get(project.id)!;

          const { count: assignedCount } = await supabase
            .from('project_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .is('removed_at', null);

          const { data: attendanceDates } = await supabase
            .from('attendance_records')
            .select('check_in_time')
            .eq('project_id', project.id)
            .not('check_in_time', 'is', null);

          const uniqueDays = new Set(
            attendanceDates?.map(record => {
              const date = new Date(record.check_in_time);
              return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            }) || []
          );

          return {
            ...project,
            request_status: projectInfo.status,
            assigned_personnel: assignedCount || 0,
            attendance_days: uniqueDays.size,
          };
        })
      );

      setProjects(projectsWithStats);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
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
          <Text style={styles.headerTitle}>Projelerim</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
        <Text style={styles.headerTitle}>Projelerim</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {projects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Henüz proje bulunmuyor</Text>
          </View>
        ) : (
          projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectCard}
              onPress={() =>
                router.push({
                  pathname: '/operations/project-detail',
                  params: { projectId: project.id },
                })
              }
            >
              <View style={styles.projectHeader}>
                <Text style={styles.projectName}>{project.name}</Text>
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
              </View>

              {project.address && (
                <View style={styles.projectInfo}>
                  <MapPin size={14} color={COLORS.textLight} />
                  <Text style={styles.projectInfoText}>
                    {project.address}
                  </Text>
                </View>
              )}

              {(project.start_date || project.end_date) && (
                <View style={styles.projectInfo}>
                  <Calendar size={14} color={COLORS.textLight} />
                  <Text style={styles.projectInfoText}>
                    {formatDate(project.start_date)} - {formatDate(project.end_date)}
                  </Text>
                </View>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Users size={16} color={COLORS.primary} />
                  <Text style={styles.statValue}>{project.assigned_personnel}</Text>
                  <Text style={styles.statLabel}>Atanan Personel</Text>
                </View>
                <View style={styles.statItem}>
                  <Clock size={16} color={COLORS.success} />
                  <Text style={styles.statValue}>{project.attendance_days}</Text>
                  <Text style={styles.statLabel}>Devam Günü</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    padding: 20,
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectName: {
    flex: 1,
    fontSize: 16,
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
    gap: 6,
    marginBottom: 8,
  },
  projectInfoText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
});
