import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, Plus, FolderOpen, FileText, Receipt, BarChart3, ArrowLeft, Briefcase, ClipboardList, DollarSign } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function OperationsScreen() {
  const router = useRouter();
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const serviceModules = (profile as any)?.service_modules || [];
  const hasPersonnel = serviceModules.includes('personnel');
  const hasTechnical = serviceModules.includes('technical');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Operasyon</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <LogOut size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => router.push('/operations/dashboard')}
        >
          <BarChart3 size={28} color="white" />
          <View style={{ flex: 1 }}>
            <Text style={styles.dashboardButtonTitle}>Dashboard</Text>
            <Text style={styles.dashboardButtonSub}>Detaylı istatistikleri görüntüle</Text>
          </View>
        </TouchableOpacity>

        {hasPersonnel && (
          <>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/operations/projects')}
            >
              <FolderOpen size={24} color={COLORS.success} />
              <Text style={styles.actionText}>Projelerim (Personel)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/operations/create-request')}
            >
              <Plus size={24} color={COLORS.primary} />
              <Text style={styles.actionText}>Personel Talebi Oluştur</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/operations/timesheets')}
            >
              <FileText size={24} color={COLORS.success} />
              <Text style={styles.actionText}>Puantaj Dönemleri</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/operations/invoices')}
            >
              <Receipt size={24} color={COLORS.warning} />
              <Text style={styles.actionText}>Hakediş Kayıtları</Text>
            </TouchableOpacity>

            <View style={styles.sectionDivider}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionTitle}>Birim Bazlı İş Sistemi</Text>
              <View style={styles.sectionLine} />
            </View>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/operations/create-unit-work-order')}
            >
              <Plus size={24} color="#8b5cf6" />
              <Text style={styles.actionText}>Yeni İş Emri Oluştur</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/operations/unit-work-orders')}
            >
              <ClipboardList size={24} color={COLORS.primary} />
              <Text style={styles.actionText}>İş Emirlerim</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/operations/unit-invoices')}
            >
              <DollarSign size={24} color={COLORS.success} />
              <Text style={styles.actionText}>Birim Bazlı Hakedişler</Text>
            </TouchableOpacity>
          </>
        )}



      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    gap: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    elevation: 2,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  dashboardButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    gap: 15,
    elevation: 3,
  },
  dashboardButtonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  dashboardButtonSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
