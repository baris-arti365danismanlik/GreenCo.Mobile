import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Eye, CheckSquare } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type StaffCardProps = {
  staff: {
    id: number;
    name: string;
    role: string;
    rating: number;
  };
  isSelected: boolean;
  onToggle: () => void;
  onViewProfile: () => void;
};

export function StaffCard({ staff, isSelected, onToggle, onViewProfile }: StaffCardProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[
        styles.staffCard,
        isSelected && { borderColor: COLORS.primary, borderWidth: 1 },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View
          style={[
            styles.checkbox,
            isSelected && { backgroundColor: COLORS.primary },
          ]}
        >
          {isSelected && <CheckSquare size={14} color="white" />}
        </View>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.cardTitle}>{staff.name}</Text>
          <Text style={styles.cardSub}>{staff.role}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={12}
              color={COLORS.warning}
              fill={s <= staff.rating ? COLORS.warning : 'transparent'}
            />
          ))}
        </View>
        <TouchableOpacity onPress={onViewProfile} style={{ padding: 5 }}>
          <Eye size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  staffCard: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.textLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textLight,
  },
});
