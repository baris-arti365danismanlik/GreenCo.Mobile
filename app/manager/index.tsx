import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, Wrench, ChevronRight, User } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Kadro360Logo } from '@/components/Kadro360Logo';
import React from 'react';

type ServiceModule = {
  id: 'personnel' | 'technical';
  name: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
  route: string;
};

const MODULES: ServiceModule[] = [
  {
    id: 'personnel',
    name: 'Personel Hizmetleri',
    description: 'Personel talepleri ve yönetimi',
    icon: Users,
    color: '#059669',
    bgColor: '#d1fae5',
    route: '/manager/projects',
  },
  {
    id: 'technical',
    name: 'Teknik Hizmetler',
    description: 'Teknik destek ve çözümler',
    icon: Wrench,
    color: '#2563eb',
    bgColor: '#dbeafe',
    route: '/manager/technical-requests',
  },
];

export default function ManagerModuleSelect() {
  const router = useRouter();
  const { profile } = useAuth();

  const serviceModules = (profile as any)?.service_modules || [];

  const availableModules = MODULES.filter(module =>
    serviceModules.includes(module.id)
  );

  React.useEffect(() => {
    if (availableModules.length === 1) {
      router.replace(availableModules[0].route);
    }
  }, [availableModules]);

  if (availableModules.length === 1) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={{ fontSize: 24, fontWeight: '700' }}>
            <Text style={{ color: '#2477AD' }}>KADRO</Text>
            <Text style={{ color: '#1B96D1' }}>360</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/manager/profile')}
        >
          <User size={24} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Hoş Geldiniz</Text>
          <Text style={styles.subtitle}>{profile?.full_name || 'Kullanıcı'}</Text>
          <Text style={styles.description}>Kullanmak istediğiniz hizmeti seçin</Text>

          <View style={styles.modulesContainer}>
            {availableModules.map(module => {
              const Icon = module.icon;
              return (
                <TouchableOpacity
                  key={module.id}
                  style={[
                    styles.moduleCard,
                    { borderLeftColor: module.color, borderLeftWidth: 4 },
                  ]}
                  onPress={() => router.push(module.route)}
                >
                  <View
                    style={[styles.iconContainer, { backgroundColor: module.bgColor }]}
                  >
                    <Icon size={32} color={module.color} />
                  </View>
                  <View style={styles.moduleInfo}>
                    <Text style={styles.moduleName}>{module.name}</Text>
                    <Text style={styles.moduleDescription}>{module.description}</Text>
                  </View>
                  <ChevronRight size={24} color={COLORS.textLight} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerLeft: {
    // Optional styling if need to adjust logo position
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 40,
    textAlign: 'center',
  },
  modulesContainer: {
    width: '100%',
    gap: 16,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  moduleDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
  },
});
