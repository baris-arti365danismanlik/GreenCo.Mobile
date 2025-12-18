import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { X, Plus, ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type FilterableDropdownProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ id: string; name: string }>;
  placeholder?: string;
  disabled?: boolean;
  onAddNew?: (name: string) => Promise<void>;
  loading?: boolean;
};

export default function FilterableDropdown({
  label,
  value,
  onValueChange,
  items,
  placeholder = 'Seçiniz',
  disabled = false,
  onAddNew,
  loading = false,
}: FilterableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedItem = items.find((item) => item.id === value);
  const displayText = selectedItem?.name || placeholder;

  const hasExactMatch = filteredItems.some(
    (item) => item.name.toLowerCase() === searchQuery.toLowerCase()
  );

  const canAddNew = onAddNew && searchQuery.trim().length > 0 && !hasExactMatch;

  const handleAddNew = async () => {
    if (!onAddNew || !searchQuery.trim()) return;

    try {
      setIsAdding(true);
      await onAddNew(searchQuery.trim());
      setSearchQuery('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding new item:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelect = (itemId: string) => {
    onValueChange(itemId);
    setSearchQuery('');
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Text style={[styles.selectorText, !selectedItem && styles.placeholderText]}>
          {displayText}
        </Text>
        <ChevronDown size={20} color={disabled ? COLORS.textLight : COLORS.secondary} />
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
                <X size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Ara veya yeni ekle..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <>
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id}
                  style={styles.list}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.listItem, item.id === value && styles.listItemSelected]}
                      onPress={() => handleSelect(item.id)}
                    >
                      <Text
                        style={[
                          styles.listItemText,
                          item.id === value && styles.listItemTextSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        {searchQuery ? 'Sonuç bulunamadı' : 'Liste boş'}
                      </Text>
                    </View>
                  }
                />

                {canAddNew && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddNew}
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Plus size={20} color="#fff" />
                        <Text style={styles.addButtonText}>"{searchQuery}" ekle</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  selectorText: {
    fontSize: 16,
    color: COLORS.secondary,
    flex: 1,
  },
  placeholderText: {
    color: COLORS.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.secondary,
  },
  list: {
    maxHeight: 300,
  },
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  listItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  listItemText: {
    fontSize: 16,
    color: COLORS.secondary,
  },
  listItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
});
