import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileText, CheckCircle, Clock, Package } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type WorkOrder = {
  id: string;
  order_number: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  project: { name: string };
  service_type: { name: string; unit_type: string };
};

export default function ManagerUnitWorkOrdersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);

      const { data: managedProjects } = await supabase
        .from('project_managers')
        .select('project_id')
        .eq('manager_id', profile!.id);

      const projectIds = managedProjects?.map(pm => pm.project_id) || [];

      if (projectIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('unit_based_work_orders')
        .select(`
          *,
          project:projects_greenco(name),
          service_type:service_types(name, unit_type)
        `)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error: any) {
      console.error('İş emirleri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      case 'rejected':
        return COLORS.error;
      case 'completed':
        return COLORS.primary;
      default:
        return COLORS.textLight;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Onay Bekliyor';
      case 'approved':
        return 'Onaylandı';
      case 'rejected':
        return 'Reddedildi';
      case 'completed':
        return 'Tamamlandı';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Birim Bazlı İş Emirleri</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Birim Bazlı İş Emirleri</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {workOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Henüz iş emri bulunmuyor</Text>
          </View>
        ) : (
          workOrders.map((order) => (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNumber}>#{order.order_number}</Text>
                  <Text style={styles.projectName}>{order.project.name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                    {getStatusText(order.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <FileText size={16} color={COLORS.textLight} />
                  <Text style={styles.infoLabel}>Hizmet:</Text>
                  <Text style={styles.infoValue}>{order.service_type.name}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Package size={16} color={COLORS.textLight} />
                  <Text style={styles.infoLabel}>Miktar:</Text>
                  <Text style={styles.infoValue}>
                    {order.quantity} {order.service_type.unit_type}
                  </Text>
                </View>

                {order.unit_price && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Birim Fiyat:</Text>
                    <Text style={styles.infoValue}>₺{order.unit_price.toFixed(2)}</Text>
                  </View>
                )}

                <View style={[styles.infoRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Toplam Tutar:</Text>
                  <Text style={styles.totalValue}>₺{order.total_amount.toFixed(2)}</Text>
                </View>

                <View style={styles.dateRow}>
                  <Calendar size={14} color={COLORS.textLight} />
                  <Text style={styles.dateText}>
                    {new Date(order.start_date).toLocaleDateString('tr-TR')} - {new Date(order.end_date).toLocaleDateString('tr-TR')}
                  </Text>
                </View>

                {order.description && (
                  <Text style={styles.description}>{order.description}</Text>
                )}
              </View>
            </View>
          ))
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  projectName: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  description: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
