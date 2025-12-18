import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants/theme';

export default function TechnicalModuleIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/technical/dashboard');
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
