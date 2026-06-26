// components/ScreenContainer.tsx
import React from 'react';
import { Platform, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children }) => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b132b' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0b132b" />
      
      <View 
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
          backgroundColor: '#0b132b'
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
};
