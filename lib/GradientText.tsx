import React from 'react';
import { View, Text, ViewStyle, TextStyle, LayoutChangeEvent, Platform } from 'react-native';
import MaskedView from '@react-native-community/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientTextProps {
  text: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  colors?: string[];
}

export const GradientText: React.FC<GradientTextProps> = ({
  text,
  style,
  containerStyle,
  colors = ['#0066FF', '#8B00FF', '#FF1493'],
}) => {
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  
  // 在逗号之后换行
  const parts = text.split(',');
  const lines: string[] = [];
  parts.forEach((part, index) => {
    if (index === 0) {
      lines.push(part.trim() + ',');
    } else {
      lines.push(part.trim());
    }
  });

  // 在Android上使用渐变的第一个颜色作为单色文字颜色，在iOS上保留渐变效果
  const isAndroid = Platform.OS === 'android';
  const solidColor = colors[0] || '#6C5CE7'; // 使用第一个渐变颜色或默认主题色

  const textStyle: TextStyle = {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    ...style,
    // Android上使用单色，iOS上不需要设置颜色（渐变会处理）
    ...(isAndroid && { color: solidColor }),
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (dimensions.width !== width || dimensions.height !== height)) {
      setDimensions({ width, height });
    }
  };

  // Android上直接使用单色文字，避免MaskedView的兼容性问题
  if (isAndroid) {
    return (
      <View style={[{ alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
        <Text style={textStyle}>{lines.join('\n')}</Text>
      </View>
    );
  }

  // iOS上保留渐变效果
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <MaskedView
          style={{ width: dimensions.width, height: dimensions.height, alignItems: 'center', justifyContent: 'center' }}
          maskElement={
            <View style={{ width: dimensions.width, height: dimensions.height, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={textStyle}>{lines.join('\n')}</Text>
            </View>
          }
        >
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: dimensions.width, height: dimensions.height }}
          />
        </MaskedView>
      ) : (
        <View
          onLayout={onLayout}
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={textStyle}>{lines.join('\n')}</Text>
        </View>
      )}
    </View>
  );
};

