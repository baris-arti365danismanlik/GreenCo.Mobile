import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Image } from 'react-native';

interface Kadro360LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'colored' | 'dark'; // variant affects text visibility on dark backgrounds if needed
  style?: ViewStyle;
}

export const Kadro360Logo = ({ size = 'medium', variant = 'colored', style }: Kadro360LogoProps) => {
  const iconSize = size === 'large' ? 220 : size === 'medium' ? 100 : 64;
  const nameSize = size === 'large' ? 40 : size === 'medium' ? 24 : 16;

  // Colors provided by user
  const colors = {
    darkBlue: '#2477AD',
    turquoise: '#1B96D1',
    text: variant === 'dark' ? '#ffffff' : '#2477AD', // Use darkBlue for text primarily, or white if on dark bg
  };

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../assets/images/kadro-icon.png')}
        style={{ width: iconSize, height: iconSize }}
        resizeMode="contain"
      />
      <View style={styles.textContainer}>
        <Text style={[styles.brandName, { fontSize: nameSize, color: colors.darkBlue }]}>
          KADRO
        </Text>
        <Text style={[styles.brandName, { fontSize: nameSize, color: colors.turquoise }]}>
          360
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flexDirection: 'row',
    marginTop: -30,
    alignItems: 'center',
  },
  brandName: {
    fontWeight: '900',
    letterSpacing: -1,
  },
});
