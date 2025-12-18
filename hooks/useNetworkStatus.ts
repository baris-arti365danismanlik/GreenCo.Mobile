import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web'de her zaman online varsayalım
      setIsConnected(true);
      setIsInternetReachable(true);

      // İsterseniz navigator.onLine API'sini kullanabilirsiniz
      const handleOnline = () => setIsConnected(true);
      const handleOffline = () => setIsConnected(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // Native platformlarda NetInfo kullan
      const NetInfo = require('@react-native-community/netinfo').default;
      const unsubscribe = NetInfo.addEventListener((state: any) => {
        setIsConnected(state.isConnected ?? false);
        setIsInternetReachable(state.isInternetReachable ?? false);
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  return {
    isConnected,
    isInternetReachable,
    isOnline: isConnected && isInternetReachable,
  };
}
