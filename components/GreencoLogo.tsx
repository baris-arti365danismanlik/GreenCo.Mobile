import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Leaf } from 'lucide-react-native';

interface GreencoLogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'light' | 'dark';
  style?: ViewStyle;
}

export function GreencoLogo({ size = 'large', variant = 'light', style }: GreencoLogoProps) {
  const iconSize = size === 'large' ? 90 : size === 'medium' ? 50 : 32;
  const nameSize = size === 'large' ? 70 : size === 'medium' ? 40 : 24;
  const subSize = size === 'large' ? 20 : size === 'medium' ? 12 : 8;

  const colors = {
    icon: variant === 'dark' ? '#ffffff' : '#15803d',
    name: variant === 'dark' ? '#ffffff' : '#15803d',
    sub: variant === 'dark' ? '#ffffff' : '#64748b',
  };

  return (
    <View style={[styles.container, style]}>
      <Leaf size={iconSize} color={colors.icon} strokeWidth={2.5} />
      <Text style={[styles.brandName, { fontSize: nameSize, color: colors.name }]}>
        GREENCO
      </Text>
      <Text style={[styles.brandSub, { fontSize: subSize, color: colors.sub }]}>
        SERVICE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontWeight: '900',
    letterSpacing: -2,
    marginTop: 20,
    lineHeight: undefined,
  },
  brandSub: {
    fontWeight: '700',
    letterSpacing: 10,
    marginTop: 12,
    textTransform: 'uppercase',
  },
});
