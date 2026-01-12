import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type InputGroupProps = TextInputProps & {
  icon?: LucideIcon;
  label?: string;
  isError?: boolean;
  errorMessage?: string;
};

export function InputGroup({
  icon: Icon,
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  isError,
  errorMessage,
  editable = true,
  ...rest
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
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          placeholderTextColor={COLORS.textLight}
          editable={editable}
          {...rest}
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
