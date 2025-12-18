import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import FilterableDropdown from '@/components/FilterableDropdown';

export default function CreateUnitInvoiceScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);
  const [selectedOrderData, setSelectedOrderData] = useState<any>(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadApprovedWorkOrders();
  }, []);

  useEffect(() => {
    if (selectedWorkOrder) {
      const order = workOrders.find(o => o.id === selectedWorkOrder);
      setSelectedOrderData(order);
    } else {
      setSelectedOrderData(null);
    }
  }, [selectedWorkOrder]);

  const loadApprovedWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('unit_based_work_orders')
        .select(`
          *,
          project:projects_greenco(name),
          service_type:service_types(name, unit_type)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `UBH-${year}${month}-${random}`;
  };

  const handleSubmit = async () => {
    if (!selectedWorkOrder || !invoiceDate) {
      Alert.alert('Uyarı', 'Lütfen iş emri ve hakediş tarihi seçiniz');
      return;
    }

    setLoading(true);
    try {
      const invoiceNumber = generateInvoiceNumber();

      const { data: invoice, error: invoiceError } = await supabase
        .from('unit_invoices')
        .insert({
          invoice_number: invoiceNumber,
          work_order_id: selectedWorkOrder,
          project_id: selectedOrderData.project_id,
          invoice_date: invoiceDate,
          total_amount: selectedOrderData.total_amount,
          notes: notes.trim() || null,
          created_by: profile?.id,
          status: 'pending_manager_review',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const { error: updateError } = await supabase
        .from('unit_based_work_orders')
        .update({
          status: 'completed',
        })
        .eq('id', selectedWorkOrder);

      if (updateError) throw updateError;

      Alert.alert('Başarılı', 'Hakediş oluşturuldu', [
        { text: 'Tamam', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Hakediş oluşturma hatası:', error);
      Alert.alert('Hata', error.message);
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
        <Text style={styles.headerTitle}>Hakediş Oluştur</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <FilterableDropdown
            label="İş Emri *"
            value={selectedWorkOrder || ''}
            onValueChange={setSelectedWorkOrder}
            items={workOrders.map(o => ({
              id: o.id,
              name: `#${o.order_number} - ${o.project?.name}`
            }))}
            placeholder="İş Emri Seçin"
          />
        </View>

        {selectedOrderData && (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>İş Emri Detayları</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Proje:</Text>
                <Text style={styles.infoValue}>{selectedOrderData.project?.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Hizmet Türü:</Text>
                <Text style={styles.infoValue}>
                  {selectedOrderData.service_type?.name}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Miktar:</Text>
                <Text style={styles.infoValue}>
                  {selectedOrderData.quantity} {selectedOrderData.service_type?.unit_type}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Birim Fiyat:</Text>
                <Text style={styles.infoValue}>
                  ₺{selectedOrderData.unit_price?.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 }]}>
                <Text style={[styles.infoLabel, { fontWeight: '700', fontSize: 16 }]}>
                  Toplam Tutar:
                </Text>
                <Text style={[styles.infoValue, { fontWeight: '700', fontSize: 18, color: COLORS.success }]}>
                  ₺{selectedOrderData.total_amount?.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Hakediş Tarihi *</Text>
              <TextInput
                style={styles.input}
                value={invoiceDate}
                onChangeText={setInvoiceDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textLight}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Notlar</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Hakediş ile ilgili notlar..."
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Save size={20} color="white" />
              )}
              <Text style={styles.submitButtonText}>
                {loading ? 'Oluşturuluyor...' : 'Hakediş Oluştur'}
              </Text>
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
  infoCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
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
