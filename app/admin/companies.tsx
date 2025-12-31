import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Search, Building2, Pencil, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { InputGroup } from '@/components/InputGroup';
import { useAuth } from '@/contexts/AuthContext';

type Company = {
  id: string;
  name: string;
  tax_number: string;
  address: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  commission_rate: number | null;
  is_active: boolean;
};

export default function CompaniesManagement() {
  const router = useRouter();
  const { forceRefreshSession } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    tax_number: '',
    address: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    commission_rate: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterCompanies();
  }, [searchQuery, companies]);

  const loadData = async () => {
    try {
      setLoading(true);

      const companiesRes = await supabase
        .from('companies')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (companiesRes.error) throw companiesRes.error;

      setCompanies(companiesRes.data || []);
    } catch (error) {
      Alert.alert('Hata', 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const filterCompanies = () => {
    if (!searchQuery.trim()) {
      setFilteredCompanies(companies);
      return;
    }

    const filtered = companies.filter(
      (company) =>
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.tax_number.includes(searchQuery)
    );
    setFilteredCompanies(filtered);
  };

  const openModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        tax_number: company.tax_number,
        address: company.address || '',
        contact_person: company.contact_person || '',
        contact_email: company.contact_email || '',
        contact_phone: company.contact_phone || '',
        commission_rate: company.commission_rate ? (company.commission_rate * 100).toString() : '',
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        tax_number: '',
        address: '',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        commission_rate: '',
      });
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingCompany(null);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!formData.name) {
      Alert.alert('Hata', 'Firma adı zorunludur');
      return;
    }

    if (saving) return;

    try {
      setSaving(true);

      // PRE-CHECK: Duplicate Validation
      if (!editingCompany) {
        // 1. Check Tax Number
        const { data: taxCheck } = await supabase
          .from('companies')
          .select('id')
          .eq('tax_number', formData.tax_number)
          .is('deleted_at', null) // Only check active/non-deleted companies
          .maybeSingle();

        if (taxCheck) {
          setSaving(false);
          Alert.alert('Hata', 'Bu vergi numarası zaten başka bir firmada kayıtlı.');
          return;
        }

        // 2. Check Company Name
        const { data: nameCheck } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', formData.name) // Case insensitive check
          .is('deleted_at', null)
          .maybeSingle();

        if (nameCheck) {
          setSaving(false);
          Alert.alert('Hata', 'Bu şirket adı sistemde zaten kayıtlı.');
          return;
        }
      }

      await forceRefreshSession();

      // Kullanıcının girdiği yüzdeyi (örn: 10) ondalığa çevir (0.10)
      const commissionRate = formData.commission_rate ? parseFloat(formData.commission_rate) / 100 : null;

      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update({
            name: formData.name,
            tax_number: formData.tax_number,
            address: formData.address || null,
            contact_person: formData.contact_person || null,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            commission_rate: commissionRate,
          })
          .eq('id', editingCompany.id);

        if (error) throw error;
      } else {
        const { error: companyError } = await supabase
          .from('companies')
          .insert({
            name: formData.name,
            tax_number: formData.tax_number || null,
            address: formData.address || null,
            contact_person: formData.contact_person || null,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            commission_rate: commissionRate,
          });

        if (companyError) throw companyError;
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('Error saving company:', error);

      let errorMessage = error.message || 'İşlem başarısız';

      if (error.code === '23505' || errorMessage.includes('unique constraint')) {
        if (errorMessage.includes('tax_number')) {
          errorMessage = 'Bu vergi numarası zaten başka bir firmada kayıtlı.';
        } else if (errorMessage.includes('name')) {
          errorMessage = 'Bu şirket adı sistemde zaten kayıtlı.';
        } else {
          errorMessage = 'Bu kayıt mükerrer olduğu için oluşturulamadı (Vergi No veya İsim çakışması).';
        }
      }

      Alert.alert('Hata', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (companyId: string) => {
    const confirmMessage = 'Bu firmayı silmek istediğinize emin misiniz? Firmaya bağlı tüm kayıtlar ve kullanıcılar da silinecektir.';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return;
      }
    } else {
      Alert.alert('Emin misiniz?', confirmMessage, [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await performDelete();
          },
        },
      ]);
      return;
    }

    await performDelete();

    async function performDelete() {
      try {
        await forceRefreshSession();

        // 1. Firmayı soft-delete yap (Hem deleted_at hem is_active)
        const { error: companyError } = await supabase
          .from('companies')
          .update({
            deleted_at: new Date().toISOString(),
            is_active: false
          })
          .eq('id', companyId);

        if (companyError) throw companyError;

        // 2. Firmaya ait projeleri pasife çek
        const { error: projectsError } = await supabase
          .from('projects_greenco')
          .update({ is_active: false })
          .eq('company_id', companyId);

        if (projectsError) {
          console.warn('Projeler pasife çekilirken hata:', projectsError);
        }

        // 3. Firmaya ait kullanıcıları pasife çek
        const { error: profilesError } = await supabase
          .from('profiles')
          .update({ is_active: false })
          .eq('company_id', companyId);

        if (profilesError) {
          console.warn('Kullanıcılar pasife çekilirken hata:', profilesError);
        }

        if (Platform.OS === 'web') {
          alert('Başarılı: Firma ve bağlı tüm kayıtlar silindi (Pasife alındı)');
        } else {
          Alert.alert('Başarılı', 'Firma ve bağlı tüm kayıtlar silindi (Pasife alındı)');
        }
        loadData();
      } catch (error: any) {
        if (Platform.OS === 'web') {
          alert(`Hata: ${error.message || 'Silme başarısız'}`);
        } else {
          Alert.alert('Hata', error.message || 'Silme başarısız');
        }
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Firma Yönetimi</Text>
        <TouchableOpacity onPress={() => openModal()}>
          <Plus size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Firma adı, vergi no ile ara..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : filteredCompanies.length === 0 ? (
          <Text style={styles.emptyText}>Firma bulunamadı</Text>
        ) : (
          filteredCompanies.map((company) => (
            <View key={company.id} style={styles.companyCard}>
              <View style={styles.companyIcon}>
                <Building2 size={20} color={COLORS.primary} />
              </View>
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{company.name}</Text>
                <Text style={styles.companyTax}>VN: {company.tax_number}</Text>
                {company.commission_rate && (
                  <Text style={styles.companyContact}>Komisyon: %{company.commission_rate * 100}</Text>
                )}
                {company.contact_person && (
                  <Text style={styles.companyContact}>{company.contact_person}</Text>
                )}
                {company.contact_phone && (
                  <Text style={styles.companyPhone}>{company.contact_phone}</Text>
                )}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openModal(company)} style={styles.editBtn}>
                  <Pencil size={18} color={COLORS.blue} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(company.id)} style={styles.deleteBtn}>
                  <Trash2 size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCompany ? 'Firma Düzenle' : 'Yeni Firma'}
            </Text>

            <ScrollView>
              <InputGroup
                placeholder="Firma Adı *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

              <InputGroup
                placeholder="Vergi Numarası *"
                value={formData.tax_number}
                onChangeText={(text) => setFormData({ ...formData, tax_number: text })}
                keyboardType="numeric"
              />

              <InputGroup
                placeholder="Komisyon Oranı (%)"
                value={formData.commission_rate}
                onChangeText={(text) => setFormData({ ...formData, commission_rate: text })}
                keyboardType="numeric"
              />

              <InputGroup
                placeholder="Adres"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
              />

              <InputGroup
                placeholder="Yetkili Kişi"
                value={formData.contact_person}
                onChangeText={(text) => setFormData({ ...formData, contact_person: text })}
              />

              <InputGroup
                placeholder="E-posta"
                value={formData.contact_email}
                onChangeText={(text) => setFormData({ ...formData, contact_email: text })}
                keyboardType="email-address"
              />

              <InputGroup
                placeholder="Telefon"
                value={formData.contact_phone}
                onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
                keyboardType="phone-pad"
              />
            </ScrollView>


            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <View style={styles.savingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.saveBtnText}>Kaydediliyor...</Text>
                  </View>
                ) : (
                  <Text style={styles.saveBtnText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 40,
  },
  companyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  companyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  companyTax: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  companyContact: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 4,
  },
  companyPhone: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    padding: 8,
  },
  deleteBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
