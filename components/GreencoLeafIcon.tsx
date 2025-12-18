import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { ViewStyle } from 'react-native';

interface GreencoLeafIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function GreencoLeafIcon({ size = 32, color = '#1B7F4D', style }: GreencoLeafIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <Path
        d="M70 42c-5-8-13-12-22-10-2 0.5-4 1.5-5.5 3-1.5 1.5-2.5 3.5-3 5.5-2 9 2 17 10 22 4 2.5 8.5 3.5 13 3.5 1.5 0 3-0.2 4.5-0.5 2-0.5 4-1.5 5.5-3 1.5-1.5 2.5-3.5 3-5.5 0.5-1.5 0.8-3 0.8-4.5 0-4.5-1-9-3.5-13l-2.8 2.5zm-2.5 13c-0.3 1.2-0.8 2.3-1.6 3.1-0.8 0.8-1.9 1.3-3.1 1.6-4.5 1.2-9.2 0-12.5-3.2-5-4-7-10-5.5-15.5 0.3-1.2 0.8-2.3 1.6-3.1 0.8-0.8 1.9-1.3 3.1-1.6 0.7-0.2 1.4-0.3 2-0.3 3.5 0 6.8 1.5 8.5 4.2 2 3.2 2.8 7.1 2 11-0.2 1.3-0.8 2.6-1.6 3.8h7.1z"
        fill={color}
      />
    </Svg>
  );
}
