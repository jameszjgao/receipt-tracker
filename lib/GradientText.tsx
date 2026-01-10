import React from 'react';
import { View, Text, ViewStyle, TextStyle, LayoutChangeEvent } from 'react-native';
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

  const textStyle: TextStyle = {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    ...style,
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (dimensions.width !== width || dimensions.height !== height)) {
      setDimensions({ width, height });
    }
  };

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

