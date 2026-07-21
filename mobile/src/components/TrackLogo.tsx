import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface TrackLogoProps {
  width?: number | string;
  height?: number | string;
  style?: StyleProp<ImageStyle>;
}

export default function TrackLogo({ width = 320, height = 100, style }: TrackLogoProps) {
  return (
    <Image
      source={require('../../assets/images/logo.png')}
      style={[
        {
          width: width as any,
          height: height as any,
          alignSelf: 'center',
        },
        style,
      ]}
      resizeMode="contain"
    />
  );
}
