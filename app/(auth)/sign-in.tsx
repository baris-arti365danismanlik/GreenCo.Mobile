import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, Lock, KeyRound } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { InputGroup } from '@/components/InputGroup';
import { useAuth } from '@/contexts/AuthContext';
import { Kadro360Logo } from '@/components/Kadro360Logo';

export default function SignIn() {
  const router = useRouter();
  const { signInWithPassword } = useAuth();
  const [step, setStep] = useState<'phone' | 'password' | 'otp' | 'newPassword'>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSubmitting = useRef(false);

  const handlePhoneSubmit = () => {
    setError('');
    if (phone.length > 3) {
      setStep('password');
    } else {
      setError('Lütfen geçerli bir numara girin');
    }
  };

  const handlePasswordSubmit = async () => {
    if (isSubmitting.current) {
      console.log('Zaten giriş yapılıyor, tekrar deneme engellendi');
      return;
    }

    setError('');
    if (!password.trim()) {
      setError('Lütfen şifrenizi girin');
      return;
    }

    isSubmitting.current = true;
    setLoading(true);

    try {
      console.log('Giriş denemesi:', phone);
      const { error: authError } = await signInWithPassword(phone, password);

      if (authError) {
        console.error('Giriş hatası:', authError);
        setError('Telefon numarası veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
        setLoading(false);
        isSubmitting.current = false;
        return;
      }

      console.log('Giriş başarılı! Profil yükleniyor ve yönlendirilecek...');

      // Reset states after successful login - AuthContext will handle the redirect
      setTimeout(() => {
        setLoading(false);
        isSubmitting.current = false;
      }, 100);
    } catch (err: any) {
      console.error('Beklenmeyen hata:', err);
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Kadro360Logo size="large" variant="colored" />
          </View>

          {step === 'phone' && (
            <View style={styles.formContainer}>
              <InputGroup
                icon={Phone}
                placeholder="Telefon (5XX...)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handlePhoneSubmit}>
                <Text style={styles.primaryBtnText}>Devam Et</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'password' && (
            <View style={styles.formContainer}>
              <View style={styles.phoneRow}>
                <Text style={styles.phoneText}>{phone}</Text>
                <TouchableOpacity onPress={() => { setStep('phone'); setError(''); }}>
                  <Text style={styles.changeText}>Değiştir</Text>
                </TouchableOpacity>
              </View>
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <InputGroup
                icon={Lock}
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handlePasswordSubmit}
                disabled={loading}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => setStep('otp')}
              >
                <Text style={styles.forgotText}>Şifremi Unuttum</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'otp' && (
            <View style={styles.formContainer}>
              <TouchableOpacity
                onPress={() => { setStep('password'); setError(''); setOtp(''); }}
                style={styles.backToPassword}
              >
                <Text style={styles.backText}>← Giriş Ekranına Dön</Text>
              </TouchableOpacity>
              <Text style={styles.infoText}>
                Telefonunuza gelen kodu giriniz.
              </Text>
              <InputGroup
                icon={KeyRound}
                placeholder="SMS Kodu"
                value={otp}
                onChangeText={setOtp}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setStep('newPassword')}
              >
                <Text style={styles.primaryBtnText}>Doğrula</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'newPassword' && (
            <View style={styles.formContainer}>
              <TouchableOpacity
                onPress={() => { setStep('password'); setError(''); setOtp(''); }}
                style={styles.backToPassword}
              >
                <Text style={styles.backText}>← Giriş Ekranına Dön</Text>
              </TouchableOpacity>
              <Text style={styles.infoText}>
                Yeni şifrenizi belirleyiniz.
              </Text>
              <InputGroup icon={Lock} placeholder="Yeni Şifre" secureTextEntry />
              <InputGroup icon={Lock} placeholder="Tekrar" secureTextEntry />
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  Alert.alert('Başarılı', 'Şifreniz güncellendi.');
                  setStep('password');
                }}
              >
                <Text style={styles.primaryBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  content: {
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
  },
  logoContainer: {
    width: '100%',
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
  },
  phoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  phoneText: {
    color: COLORS.text,
  },
  changeText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  forgotBtn: {
    marginTop: 15,
    alignItems: 'center',
  },
  forgotText: {
    color: COLORS.textLight,
  },
  infoText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#fee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fcc',
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
    textAlign: 'center',
  },
  backToPassword: {
    marginBottom: 16,
  },
  backText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
