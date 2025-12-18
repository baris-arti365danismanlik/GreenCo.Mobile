import { View, Text, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';

export default function ApprovalsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Puantaj Onayları</Text>
        <Text style={styles.headerSubtitle}>Proje Yöneticisi Ekranı</Text>
      </View>
      <View style={styles.content}>
        <FileText size={64} color="#d1d5db" />
        <Text style={styles.text}>
          Admin tarafından başlatılan puantaj onay süreçleri bu ekranda görüntülenecek
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
  },
});
