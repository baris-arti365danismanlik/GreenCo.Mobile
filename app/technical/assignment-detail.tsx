import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';

export default function AssignmentDetail() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Atama Detay1 (Yak1nda)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  text: {
    fontSize: 16,
    color: COLORS.textLight,
  },
});
