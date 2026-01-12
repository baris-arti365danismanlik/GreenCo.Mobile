import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Clock, CheckCircle, XCircle, DollarSign, FileText } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function UnitWorkOrdersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('unit_based_work_orders')
        .select(`
          *,
          project:projects_greenco!inner(name, company_id),
          creator:profiles!unit_based_work_orders_created_by_fkey(full_name),
          service_type:service_types(name, unit_type)
        `);

      if (profile?.company_id) {
        query = query.eq('project.company_id', profile.company_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('İş emri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: COLORS.warning, text: 'Onay Bekliyor' };
      case 'approved':
        return { icon: CheckCircle, color: COLORS.success, text: 'Onaylandı' };
      case 'in_progress':
        return { icon: DollarSign, color: COLORS.blue, text: 'Devam Ediyor' };
      case 'completed':
        return { icon: CheckCircle, color: COLORS.success, text: 'Tamamlandı' };
      case 'cancelled':
        return { icon: XCircle, color: COLORS.error, text: 'İptal Edildi' };
      default:
        return { icon: FileText, color: COLORS.textLight, text: status };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>İş Emirleri</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadOrders} />
        }
      >
        {orders.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Henüz iş emri bulunmuyor</Text>
          </View>
        )}

        {orders.map((order) => {
          const statusInfo = getStatusBadge(order.status);
          const StatusIcon = statusInfo.icon;

          return (
            <View
              key={order.id}
              style={styles.orderCard}
            >
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNumber}>#{order.order_number}</Text>
                  <Text style={styles.projectName}>{order.project?.name}</Text>
                  <Text style={styles.serviceType}>
                    {order.service_type?.name} - {order.quantity} {order.service_type?.unit_type}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                  <StatusIcon size={14} color={statusInfo.color} />
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.text}
                  </Text>
                </View>
              </View>

              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>{order.description}</Text>
              </View>

              <View style={styles.orderMeta}>
                <Text style={styles.metaText}>{formatDate(order.created_at)}</Text>
                <Text style={styles.metaText}>•</Text>
                <Text style={styles.metaText}>
                  {formatDate(order.start_date)} - {formatDate(order.end_date)}
                </Text>
              </View>

              {order.unit_price && order.unit_price > 0 && (
                <View style={styles.priceBox}>
                  <View>
                    <Text style={styles.priceLabel}>Birim Fiyat: ₺{order.unit_price.toFixed(2)}</Text>
                    <Text style={styles.priceLabel}>Toplam Tutar:</Text>
                  </View>
                  <Text style={styles.priceValue}>
                    ₺{order.total_amount?.toFixed(2) || '0.00'}
                  </Text>
                </View>
              )}

              {order.notes && order.status === 'cancelled' && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionLabel}>İptal Nedeni:</Text>
                  <Text style={styles.rejectionText}>{order.notes}</Text>
                </View>
              )}
            </View>
          );
        })}
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 15,
  },
  orderCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 2,
    fontWeight: '600',
  },
  descriptionBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  projectName: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  priceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.success + '10',
    borderRadius: 8,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },
  rejectionBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.error + '10',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: COLORS.text,
  },
});
