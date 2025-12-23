import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const hasRedirected = useRef(false);

  console.log('Index state:', {
    hasSession: !!session,
    hasProfile: !!profile,
    loading,
    profileRole: profile?.role,
    hasRedirected: hasRedirected.current
  });

  useEffect(() => {
    if (loading || hasRedirected.current) return;

    if (!session || !profile) {
      console.log('No session or profile, navigating to sign-in');
      hasRedirected.current = true;
      router.replace('/(auth)/sign-in');
      return;
    }

    const serviceModules = (profile as any)?.service_modules || [];
    const hasPersonnel = serviceModules.includes('personnel');
    const hasTechnical = serviceModules.includes('technical');
    const technicalCompanyId = (profile as any)?.technical_company_id;

    let targetRoute = '/(tabs)';

    if (profile.role === 'admin') {
      targetRoute = '/admin';
    }

    if (profile.role === 'technical_company' || technicalCompanyId) {
      targetRoute = '/technical-company';
    } else if (profile.role === 'personnel') {
      targetRoute = '/(tabs)';
    } else if (profile.role === 'project_manager') {
      if (hasPersonnel && !hasTechnical) {
        targetRoute = '/manager/projects';
      } else if (hasTechnical && !hasPersonnel) {
        targetRoute = '/technical';
      } else if (hasPersonnel && hasTechnical) {
        targetRoute = '/(auth)/role-select';
      } else {
        targetRoute = '/(auth)/role-select';
      }
    } else if (profile.role === 'operations') {
      if (hasPersonnel && !hasTechnical) {
        targetRoute = '/operations';
      } else if (hasTechnical && !hasPersonnel) {
        targetRoute = '/technical';
      } else if (hasPersonnel && hasTechnical) {
        targetRoute = '/(auth)/role-select';
      } else {
        targetRoute = '/operations';
      }
    }

    console.log('Navigating to:', targetRoute, 'for role:', profile.role, 'modules:', serviceModules);
    hasRedirected.current = true;
    router.replace(targetRoute);
  }, [loading, session, profile, router]);

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#059669" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
