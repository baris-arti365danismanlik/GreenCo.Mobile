import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { X, Plus, Check, Briefcase } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type PersonnelType = {
  id: string;
  name: string;
};

type PersonnelTypeSelectorProps = {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  allowAddNew?: boolean;
};

export function PersonnelTypeSelector({
  selectedIds,
  onSelectionChange,
  allowAddNew = false,
}: PersonnelTypeSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [personnelTypes, setPersonnelTypes] = useState<PersonnelType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPersonnelTypes();
  }, []);

  useEffect(() => {
    if (modalVisible) {
      loadPersonnelTypes();
    }
  }, [modalVisible]);

  const loadPersonnelTypes = async () => {
    try {
      console.log('PersonnelTypeSelector: Loading personnel types...');
      const { data, error } = await supabase
        .from('personnel_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      console.log('PersonnelTypeSelector: Loaded', data?.length || 0, 'personnel types');
      setPersonnelTypes(data || []);
    } catch (error) {
      console.error('PersonnelTypeSelector: Error loading personnel types:', error);
      Alert.alert('Hata', 'Meslek türleri yüklenirken bir hata oluştu');
    }
  };

  const addNewPersonnelType = async () => {
    if (!newTypeName.trim()) {
      Alert.alert('Uyarı', 'Lütfen meslek adı girin');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('personnel_types')
        .insert({ name: newTypeName.trim(), is_active: true })
        .select()
        .single();

      if (error) throw error;

      setPersonnelTypes([...personnelTypes, data]);
      onSelectionChange([...selectedIds, data.id]);
      setNewTypeName('');
      setShowAddNew(false);
      Alert.alert('Başarılı', 'Yeni meslek türü eklendi');
    } catch (error) {
      console.error('Error adding personnel type:', error);
      Alert.alert('Hata', 'Meslek türü eklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectedNames = useMemo(() => {
    console.log('PersonnelTypeSelector: Computing selectedNames - selectedIds:', selectedIds.length, 'personnelTypes:', personnelTypes.length);
    if (selectedIds.length === 0) return 'Seçilmedi';
    const names = selectedIds
      .map((id) => personnelTypes.find((pt) => pt.id === id)?.name)
      .filter(Boolean);
    console.log('PersonnelTypeSelector: Found names:', names);
    return names.join(', ') || 'Seçilmedi';
  }, [selectedIds, personnelTypes]);

  const filteredTypes = personnelTypes.filter((type) =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <TouchableOpacity style={styles.selector} onPress={() => setModalVisible(true)}>
        <Briefcase size={20} color={COLORS.textLight} />
        <Text style={styles.selectorText} numberOfLines={2}>
          {selectedNames}
        </Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meslek Seçimi</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Meslek ara..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView
              style={styles.typesList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {filteredTypes.length > 0 ? (
                filteredTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={styles.typeItem}
                    onPress={() => toggleSelection(type.id)}
                  >
                    <Text style={styles.typeName}>{type.name}</Text>
                    {selectedIds.includes(type.id) && (
                      <Check size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {personnelTypes.length === 0
                    ? 'Meslek türleri yükleniyor...'
                    : 'Meslek bulunamadı'}
                </Text>
              )}
            </ScrollView>

            {allowAddNew && (
              <View style={styles.addNewSection}>
                {showAddNew ? (
                  <View style={styles.addNewForm}>
                    <TextInput
                      style={styles.addNewInput}
                      placeholder="Yeni meslek adı"
                      value={newTypeName}
                      onChangeText={setNewTypeName}
                    />
                    <View style={styles.addNewButtons}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => {
                          setShowAddNew(false);
                          setNewTypeName('');
                        }}
                      >
                        <Text style={styles.cancelBtnText}>İptal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
                        onPress={addNewPersonnelType}
                        disabled={loading}
                      >
                        <Text style={styles.saveBtnText}>
                          {loading ? 'Ekleniyor...' : 'Ekle'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addNewBtn}
                    onPress={() => setShowAddNew(true)}
                  >
                    <Plus size={20} color={COLORS.primary} />
                    <Text style={styles.addNewBtnText}>Yeni Meslek Ekle</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.doneBtnText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardBg,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingTop: 12,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  searchInput: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
    color: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typesList: {
    maxHeight: 320,
  },
  typeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  typeName: {
    fontSize: 16,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 20,
  },
  addNewSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addNewBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  addNewForm: {
    gap: 12,
  },
  addNewInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    color: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addNewButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textLight,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: 'white',
    fontWeight: '600',
  },
  doneBtn: {
    marginTop: 16,
    padding: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
