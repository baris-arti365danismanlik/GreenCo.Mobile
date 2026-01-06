import { Stack, useRootNavigationState } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function TechnicalLayout() {
  const { profile } = useAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return;

    if (!profile?.service_modules?.includes('technical')) {
      router.replace('/(tabs)');
    }
  }, [profile, rootNavigationState]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="create-request" />
      <Stack.Screen name="request-detail" />
      <Stack.Screen name="companies" />
      <Stack.Screen name="company-detail" />
      <Stack.Screen name="bids" />
      <Stack.Screen name="assignments" />
      <Stack.Screen name="assignment-detail" />
    </Stack>
  );
}
