import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { QrCode, MapPin, CheckCircle, LogIn, LogOut, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { offlineStorage } from '@/lib/offlineStorage';
import { syncService } from '@/lib/syncService';

type Project = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
};

export default function QRScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    requestLocationPermission();
    loadPendingCount();
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncPendingRecords();
    }
  }, [isOnline]);

  const loadPendingCount = async () => {
    const count = await offlineStorage.getPendingCount();
    setPendingCount(count);
  };

  const syncPendingRecords = async () => {
    if (syncing) return;

    setSyncing(true);
    try {
      const result = await syncService.syncPendingRecords();
      if (result.success > 0) {
        Alert.alert('Senkronizasyon', `${result.success} kayıt başarıyla senkronize edildi`);
        await loadPendingCount();
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const verifyLocation = async (project: Project) => {
    if (!locationPermission) {
      return {
        verified: false,
        latitude: null,
        longitude: null,
        message: 'Konum izni verilmedi',
      };
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        project.latitude,
        project.longitude
      );

      return {
        verified: distance <= project.geofence_radius_meters,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        message:
          distance <= project.geofence_radius_meters
            ? 'Konum doğrulandı'
            : `Proje bölgesinin dışındasınız (${Math.round(distance)}m uzakta, maksimum ${project.geofence_radius_meters}m)`,
      };
    } catch (error) {
      return {
        verified: false,
        latitude: null,
        longitude: null,
        message: 'Konum alınamadı',
      };
    }
  };

  const handleQRCodeScanned = async ({ data }: { data: string }) => {
    if (processing || !scanning) return;

    setProcessing(true);
    setScanning(false);

    try {
      const { data: project, error: projectError } = await supabase
        .from('projects_greenco')
        .select('*')
        .eq('qr_code_secret', data)
        .eq('is_active', true)
        .maybeSingle();

      if (projectError || !project) {
        Alert.alert('Hata', 'Geçersiz QR kodu');
        setProcessing(false);
        setScanType(null);
        setScanning(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: shift, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('worker_id', profile?.id)
        .eq('project_id', project.id)
        .eq('shift_date', today)
        .in('status', ['scheduled', 'in_progress'])
        .maybeSingle();

      if (shiftError || !shift) {
        Alert.alert('Hata', 'Bugün bu projede vardiyınız bulunmuyor');
        setProcessing(false);
        setScanType(null);
        setScanning(false);
        return;
      }

      const locationResult = await verifyLocation(project);

      if (!locationResult.verified) {
        Alert.alert('Konum Doğrulama Hatası', locationResult.message);
        setProcessing(false);
        setScanType(null);
        setScanning(false);
        return;
      }

      const { data: existingAttendance } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('shift_id', shift.id)
        .maybeSingle();

      if (existingAttendance) {
        if (!existingAttendance.check_out_time) {
          if (scanType === 'in') {
            Alert.alert('Hata', 'Bu vardiya için zaten giriş yaptınız. Lütfen çıkış yapın.');
            setProcessing(false);
            setScanType(null);
            setScanning(false);
            return;
          }

          if (isOnline) {
            const { error: updateError } = await supabase
              .from('attendance_records')
              .update({
                check_out_time: new Date().toISOString(),
                check_out_latitude: locationResult.latitude,
                check_out_longitude: locationResult.longitude,
                check_out_qr_verified: true,
                check_out_location_verified: locationResult.verified,
              })
              .eq('id', existingAttendance.id);

            if (updateError) throw updateError;

            await supabase
              .from('profiles')
              .update({ last_qr_scan_at: new Date().toISOString() })
              .eq('id', profile?.id);
          } else {
            await offlineStorage.savePendingAttendance({
              id: `offline_${Date.now()}`,
              user_id: profile?.id || '',
              project_id: project.id,
              shift_id: shift.id,
              check_out_time: new Date().toISOString(),
              location_lat: locationResult.latitude || undefined,
              location_lon: locationResult.longitude || undefined,
              is_synced: false,
              timestamp: new Date().toISOString(),
            });
            await loadPendingCount();
          }

          setSuccessMessage(isOnline ? 'Çıkış Başarılı' : 'Çıkış Kaydedildi (Çevrimdışı)');
          setSuccess(true);
        } else {
          Alert.alert('Bilgi', 'Bu vardiya için zaten çıkış yaptınız');
          setScanType(null);
          setScanning(false);
        }
      } else {
        if (scanType === 'out') {
          Alert.alert('Hata', 'Bu vardiya için henüz giriş yapmadınız. Lütfen önce giriş yapın.');
          setProcessing(false);
          setScanType(null);
          setScanning(false);
          return;
        }

        if (isOnline) {
          const { error: insertError } = await supabase
            .from('attendance_records')
            .insert({
              shift_id: shift.id,
              worker_id: profile?.id,
              project_id: project.id,
              check_in_time: new Date().toISOString(),
              check_in_latitude: locationResult.latitude,
              check_in_longitude: locationResult.longitude,
              check_in_qr_verified: true,
              check_in_location_verified: locationResult.verified,
              is_synced: true,
            });

          if (insertError) throw insertError;

          await supabase
            .from('profiles')
            .update({ last_qr_scan_at: new Date().toISOString() })
            .eq('id', profile?.id);
        } else {
          await offlineStorage.savePendingAttendance({
            id: `offline_${Date.now()}`,
            user_id: profile?.id || '',
            project_id: project.id,
            shift_id: shift.id,
            check_in_time: new Date().toISOString(),
            location_lat: locationResult.latitude || undefined,
            location_lon: locationResult.longitude || undefined,
            is_synced: false,
            timestamp: new Date().toISOString(),
          });
          await loadPendingCount();
        }

        setSuccessMessage(isOnline ? 'Giriş Başarılı' : 'Giriş Kaydedildi (Çevrimdışı)');
        setSuccess(true);
      }
    } catch (error) {
      console.error('Error processing QR:', error);
      Alert.alert('Hata', 'İşlem sırasında bir hata oluştu');
      setScanType(null);
      setScanning(false);
    } finally {
      setProcessing(false);
    }
  };

  const startScan = (type: 'in' | 'out') => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    setScanType(type);
    setScanning(true);
    setSuccess(false);
  };

  const handleBack = () => {
    setScanType(null);
    setScanning(false);
    setSuccess(false);
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <CheckCircle
          size={80}
          color={scanType === 'in' ? COLORS.success : COLORS.error}
        />
        <Text style={styles.successTitle}>{successMessage}</Text>
        <Text style={styles.successSub}>
          Saat: {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} • Konum Doğrulandı
        </Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={handleBack}>
          <Text style={styles.outlineBtnText}>Tamam</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (scanning && scanType) {
    return (
      <View style={styles.scanningContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={handleQRCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
            <Text style={styles.scanText}>
              {scanType === 'in' ? 'Giriş' : 'Çıkış'} Kodu Okunuyor...
            </Text>
          </View>
        </CameraView>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleBack}>
          <Text style={styles.cancelBtnText}>İptal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Kamera izni kontrol ediliyor...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <QrCode size={64} color={COLORS.textLight} />
        <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
        <Text style={styles.permissionText}>
          QR kod taramak için kamera izni vermeniz gerekmektedir
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.btnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.darkContainer}>
      <View style={styles.headerDark}>
        <View>
          <Text style={styles.headerTitleWhite}>
            Merhaba {profile?.full_name || 'Personel'}
          </Text>
          <Text style={styles.headerSubWhite}>Proje Giriş/Çıkış</Text>
        </View>
      </View>
      <View style={styles.centerContent}>
        <TouchableOpacity
          style={[styles.bigQrBtn, { backgroundColor: COLORS.success }]}
          onPress={() => startScan('in')}
        >
          <LogIn size={32} color="white" />
          <Text style={styles.bigQrText}>GİRİŞ OKUT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigQrBtn, { backgroundColor: COLORS.error }]}
          onPress={() => startScan('out')}
        >
          <LogOut size={32} color="white" />
          <Text style={styles.bigQrText}>ÇIKIŞ OKUT</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusContainer}>
        {!isOnline && (
          <View style={styles.infoCardWarning}>
            <WifiOff size={20} color={COLORS.warning} />
            <Text style={styles.infoTextWarning}>Çevrimdışı Mod</Text>
          </View>
        )}

        {isOnline && pendingCount > 0 && (
          <TouchableOpacity
            style={styles.infoCard}
            onPress={syncPendingRecords}
            disabled={syncing}
          >
            <RefreshCw size={20} color={COLORS.primary} />
            <Text style={styles.infoTextPrimary}>
              {syncing ? 'Senkronize ediliyor...' : `${pendingCount} bekleyen kayıt`}
            </Text>
          </TouchableOpacity>
        )}

        {locationPermission ? (
          <View style={styles.infoCard}>
            <MapPin size={20} color={COLORS.success} />
            <Text style={styles.infoTextSuccess}>Konumunuz otomatik doğrulanacak</Text>
          </View>
        ) : (
          <View style={styles.infoCardWarning}>
            <MapPin size={20} color={COLORS.warning} />
            <Text style={styles.infoTextWarning}>Konum izni gerekli</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  darkContainer: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },
  headerDark: {
    padding: 20,
    paddingTop: 60,
  },
  headerTitleWhite: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  headerSubWhite: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  bigQrBtn: {
    width: '100%',
    height: 120,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bigQrText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#d1fae5',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    gap: 12,
  },
  infoCardWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fef3c7',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    gap: 12,
  },
  infoTextSuccess: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    flex: 1,
  },
  infoTextWarning: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.amber,
    flex: 1,
  },
  infoTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
  },
  statusContainer: {
    paddingBottom: 20,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 4,
    borderColor: COLORS.success,
    borderRadius: 20,
  },
  scanText: {
    color: 'white',
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 20,
  },
  successSub: {
    fontSize: 16,
    color: COLORS.textLight,
    marginVertical: 10,
    marginBottom: 30,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 12,
  },
  outlineBtnText: {
    fontWeight: '700',
    color: COLORS.text,
  },
});
