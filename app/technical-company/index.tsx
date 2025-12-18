import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function TechnicalCompanyIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/technical-company/dashboard');
  }, []);

  return null;
}
