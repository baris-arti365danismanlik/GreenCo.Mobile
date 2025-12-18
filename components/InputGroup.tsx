import { View, Text, TextInput, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type InputGroupProps = {
  icon?: LucideIcon;
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  isError?: boolean;
  errorMessage?: string;
  editable?: boolean;
};

export function InputGroup({
  icon: Icon,
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  isError,
  errorMessage,
  editable = true,
}: InputGroupProps) {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={styles.inputWrapper}>
        {Icon && (
          <View style={styles.inputIcon}>
            <Icon size={20} color={COLORS.textLight} />
          </View>
        )}
        <TextInput
          style={[
            styles.input,
            Icon && { paddingLeft: 45 },
            isError && { borderColor: COLORS.error },
          ]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          placeholderTextColor={COLORS.textLight}
          editable={editable}
        />
      </View>
      {isError && errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 15,
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 10,
    marginTop: 2,
  },
});
