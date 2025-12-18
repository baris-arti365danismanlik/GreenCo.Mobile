import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayout() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    console.log('Auth layout effect:', {
      loading,
      hasSession: !!session,
      hasProfile: !!profile,
      profileRole: profile?.role
    });

    if (loading) {
      console.log('Auth layout: Still loading, waiting...');
      return;
    }

    if (session && profile) {
      console.log('Auth layout: User authenticated, redirecting to role-select. Role:', profile.role);
      router.replace('/(auth)/role-select');
    } else if (session && !profile) {
      console.log('Auth layout: Session exists but no profile found');
    } else {
      console.log('Auth layout: No session, staying on auth screens');
    }
  }, [session, profile, loading, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="role-select" />
    </Stack>
  );
}
