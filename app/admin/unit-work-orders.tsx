import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, CheckCircle, XCircle, DollarSign, FileText, X, Search } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminUnitWorkOrdersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [unitPrice, setUnitPrice] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unit_based_work_orders')
        .select(`
          *,
          project:projects_greenco(name),
          creator:profiles!unit_based_work_orders_created_by_fkey(full_name),
          service_type:service_types(name, unit_type)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('İş emri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (order: any, type: 'approve' | 'reject') => {
    setSelectedOrder(order);
    setActionType(type);
    setUnitPrice('');
    setRejectionReason('');
    setModalVisible(true);
  };

  const handleApprove = async () => {
    if (!selectedOrder || !unitPrice) {
      Alert.alert('Uyarı', 'Lütfen birim fiyat giriniz');
      return;
    }

    const price = parseFloat(unitPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Uyarı', 'Geçerli bir fiyat giriniz');
      return;
    }

    try {
      const totalAmount = selectedOrder.quantity * price;

      const { error } = await supabase
        .from('unit_based_work_orders')
        .update({
          status: 'approved',
          unit_price: price,
          total_amount: totalAmount,
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'İş emri onaylandı');
      setModalVisible(false);
      loadOrders();
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  const handleReject = async () => {
    if (!selectedOrder || !rejectionReason.trim()) {
      Alert.alert('Uyarı', 'Lütfen red nedeni giriniz');
      return;
    }

    try {
      const { error } = await supabase
        .from('unit_based_work_orders')
        .update({
          status: 'cancelled',
          notes: rejectionReason.trim(),
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'İş emri reddedildi');
      setModalVisible(false);
      loadOrders();
    } catch (error: any) {
      Alert.alert('Hata', error.message);
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

  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.project?.name?.toLowerCase().includes(query) ||
      order.service_type?.name?.toLowerCase().includes(query) ||
      order.description?.toLowerCase().includes(query)
    );
  });

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
        <View style={styles.searchContainer}>
          <Search size={20} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="İş emri ara (No, Proje, İş Tipi)..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {filteredOrders.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <FileText size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>
              {orders.length === 0 ? 'Henüz iş emri bulunmuyor' : 'Arama sonucu bulunamadı'}
            </Text>
          </View>
        )}

        {filteredOrders.map((order) => {
          const statusInfo = getStatusBadge(order.status);
          const StatusIcon = statusInfo.icon;

          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNumber}>#{order.order_number}</Text>
                  <Text style={styles.projectName}>{order.project?.name}</Text>
                  <Text style={styles.serviceType}>
                    {order.service_type?.name} - {order.quantity} {order.service_type?.unit_type}
                  </Text>
                  <Text style={styles.creatorName}>
                    Oluşturan: {order.creator?.full_name}
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

              {order.status === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: COLORS.error }]}
                    onPress={() => handleOpenModal(order, 'reject')}
                  >
                    <XCircle size={18} color="white" />
                    <Text style={styles.actionButtonText}>İptal Et</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                    onPress={() => handleOpenModal(order, 'approve')}
                  >
                    <CheckCircle size={18} color="white" />
                    <Text style={styles.actionButtonText}>Onayla</Text>
                  </TouchableOpacity>
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

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === 'approve' ? 'İş Emrini Onayla' : 'İş Emrini Reddet'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {actionType === 'approve' ? (
                <>
                  <Text style={styles.label}>Birim Fiyat (₺) *</Text>
                  <TextInput
                    style={styles.input}
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={COLORS.textLight}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: COLORS.success }]}
                    onPress={handleApprove}
                  >
                    <CheckCircle size={20} color="white" />
                    <Text style={styles.submitButtonText}>Onayla ve Fiyatlandır</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Red Nedeni *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder="Red nedeninizi yazın..."
                    placeholderTextColor={COLORS.textLight}
                    multiline
                    numberOfLines={4}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: COLORS.error }]}
                    onPress={handleReject}
                  >
                    <XCircle size={20} color="white" />
                    <Text style={styles.submitButtonText}>Reddet</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginVertical: 10,
    marginTop:-15,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
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
  projectName: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  creatorName: {
    fontSize: 13,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 2,
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
  itemsList: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  itemRow: {
    marginBottom: 6,
  },
  itemText: {
    fontSize: 13,
    color: COLORS.text,
  },
  itemDescription: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
    marginLeft: 10,
  },
  totalQuantity: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },
  orderMeta: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 10,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalBody: {
    padding: 20,
    paddingBottom: 40,
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
    marginBottom: 15,
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
    padding: 16,
    borderRadius: 12,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
