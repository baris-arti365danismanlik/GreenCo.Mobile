import { Stack } from 'expo-router';

export default function TechnicalCompanyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="available-requests" />
      <Stack.Screen name="request-detail" />
      <Stack.Screen name="bids" />
      <Stack.Screen name="active-jobs" />
      <Stack.Screen name="job-detail" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
