import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Home, QrCode, ClipboardList, Settings, Users, FileText } from 'lucide-react-native';

export default function TabsLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profile?.role === 'technical_company' || (profile as any)?.technical_company_id) {
    return <Redirect href="/technical-company" />;
  }

  const isPersonnel = profile?.role === 'personnel';
  const isProjectManager = profile?.role === 'project_manager';
  const isOperations = profile?.role === 'operations';
  const isAdmin = profile?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 65,
          paddingBottom: 8,
          display: isAdmin ? 'none' : 'flex',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isPersonnel ? 'QR Tara' : 'Ana Sayfa',
          tabBarIcon: ({ size, color }) => isPersonnel ? <QrCode size={size} color={color} /> : <Home size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="personnel"
        options={{
          title: 'Personel',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
          href: isProjectManager ? '/(tabs)/personnel' : null,
        }}
      />

      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Onaylar',
          tabBarIcon: ({ size, color }) => <FileText size={size} color={color} />,
          href: isProjectManager ? '/(tabs)/approvals' : null,
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          title: 'Talepler',
          tabBarIcon: ({ size, color }) => <ClipboardList size={size} color={color} />,
          href: (isOperations || isAdmin) ? '/(tabs)/requests' : null,
        }}
      />

      <Tabs.Screen
        name="qr-scanner"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
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
