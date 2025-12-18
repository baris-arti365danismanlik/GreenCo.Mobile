import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import FilterableDropdown from '@/components/FilterableDropdown';

export default function CreateUnitWorkOrderScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, serviceTypesRes] = await Promise.all([
        supabase
          .from('projects_greenco')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('service_types')
          .select('*')
          .eq('is_active', true)
          .order('name')
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (serviceTypesRes.error) throw serviceTypesRes.error;

      setProjects(projectsRes.data || []);
      setServiceTypes(serviceTypesRes.data || []);
    } catch (error: any) {
      console.error('Veri yükleme hatası:', error);
      Alert.alert('Hata', error.message);
    }
  };

  const handleAddNewServiceType = async (name: string) => {
    try {
      // Varsayılan olarak 'm2' birimi ile oluştur
      const { data, error } = await supabase
        .from('service_types')
        .insert({
          name: name,
          unit_type: 'm2',
          is_active: true,
          created_by: profile?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Listeyi güncelle
      setServiceTypes([...serviceTypes, data]);
      setSelectedServiceType(data.id);

      Alert.alert('Başarılı', 'Yeni hizmet türü eklendi');
    } catch (error: any) {
      console.error('Hizmet türü ekleme hatası:', error);
      Alert.alert('Hata', error.message);
      throw error;
    }
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `UWO-${year}${month}${day}-${random}`;
  };

  const handleSubmit = async () => {
    if (!selectedProject || !selectedServiceType || !quantity || !description.trim()) {
      Alert.alert('Uyarı', 'Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Uyarı', 'Geçerli bir miktar giriniz');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      Alert.alert('Uyarı', 'Bitiş tarihi başlangıç tarihinden önce olamaz');
      return;
    }

    setLoading(true);
    try {
      const orderNumber = generateOrderNumber();

      const { data, error } = await supabase
        .from('unit_based_work_orders')
        .insert({
          order_number: orderNumber,
          project_id: selectedProject,
          service_type_id: selectedServiceType,
          quantity: qty,
          description: description.trim(),
          location_detail: locationDetail.trim() || null,
          start_date: startDate,
          end_date: endDate,
          status: 'pending',
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) {
        console.error('İş emri oluşturma hatası:', error);
        Alert.alert('Hata', error.message || 'İş emri oluşturulamadı');
        return;
      }

      console.log('İş emri başarıyla oluşturuldu:', data);

      // Önce router.back() ile geri git, sonra alert göster
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/operations/unit-work-orders');
      }

      // Kısa bir gecikme sonrasında alert göster
      setTimeout(() => {
        Alert.alert('Başarılı', 'İş emri oluşturuldu ve onay için gönderildi');
      }, 300);
    } catch (error: any) {
      console.error('İş emri oluşturma hatası:', error);
      Alert.alert('Hata', error.message || 'Beklenmeyen bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni İş Emri</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <FilterableDropdown
            label="Proje *"
            value={selectedProject || ''}
            onValueChange={setSelectedProject}
            items={projects.map(p => ({ id: p.id, name: p.name }))}
            placeholder="Proje Seçin"
          />
        </View>

        <View style={styles.card}>
          <FilterableDropdown
            label="Hizmet Türü *"
            value={selectedServiceType || ''}
            onValueChange={setSelectedServiceType}
            items={serviceTypes.map(s => ({
              id: s.id,
              name: `${s.name} (${s.unit_type})`
            }))}
            placeholder="Hizmet Türü Seçin"
            onAddNew={handleAddNewServiceType}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Miktar *</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Örn: 500"
            keyboardType="decimal-pad"
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>İş Açıklaması *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="İşle ilgili detayları yazın..."
            placeholderTextColor={COLORS.textLight}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Konum Detayı</Text>
          <TextInput
            style={styles.input}
            value={locationDetail}
            onChangeText={setLocationDetail}
            placeholder="Örn: Zemin Kat, Bölüm A"
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.card, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Başlangıç Tarihi *</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.label}>Bitiş Tarihi *</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Save size={20} color="white" />
          <Text style={styles.submitButtonText}>
            {loading ? 'Oluşturuluyor...' : 'İş Emri Oluştur'}
          </Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.secondary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.success,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
