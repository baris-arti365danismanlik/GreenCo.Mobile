import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type InputGroupProps = TextInputProps & {
  icon?: LucideIcon;
  label?: string;
  isError?: boolean;
  errorMessage?: string;
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
};

export function InputGroup({
  icon: Icon,
  rightIcon: RightIcon,
  onRightIconPress,
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
            RightIcon && { paddingRight: 45 },
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
        {RightIcon && (
          <View style={styles.inputRightIcon}>
            {onRightIconPress ? (
              <TouchableOpacity onPress={onRightIconPress}>
                <RightIcon size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            ) : (
              <RightIcon size={20} color={COLORS.textLight} />
            )}
          </View>
        )}
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
  inputRightIcon: {
    position: 'absolute',
    right: 12,
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
