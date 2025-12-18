import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type RoleButtonProps = {
  icon: React.ComponentType<any>;
  title: string;
  desc: string;
  color: string;
  onPress: () => void;
};

export function RoleButton({ icon: Icon, title, desc, color, onPress }: RoleButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.roleBtn,
        { borderColor: color + '40', backgroundColor: color + '10' },
      ]}
      onPress={onPress}
    >
      <View style={[styles.roleIcon, { backgroundColor: 'white' }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.roleTitle, { color: color }]}>{title}</Text>
        <Text style={styles.roleDesc}>{desc}</Text>
      </View>
      <ChevronRight size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  roleDesc: {
    fontSize: 12,
    color: COLORS.textLight,
  },
});
