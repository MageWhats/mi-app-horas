// components/ScreenContainer.tsx
import React from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children }) => {
  // Captura milimétricamente el tamaño del notch o la cámara del celular en vivo
  const insets = useSafeAreaInsets();

  return (
    <View 
      style={[
        styles.container, 
        { 
          // Agrega el espacio superior exacto del teléfono; en la Web le da un margen limpio de 16px
          paddingTop: Platform.OS === 'web' ? 8 : Math.max(insets.top, 8),
          paddingBottom: Platform.OS === 'web' ? 0 : insets.bottom 
        }
      ]}
    >
      {/* Configura la barra de estado superior (hora y batería) en modo claro para tu fondo oscuro */}
      <StatusBar barStyle="light-content" backgroundColor="#0b132b" />
      
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b132b', // Fondo base Mar Profundo
  },
  content: {
    flex: 1,
    paddingHorizontal: 12, // Alineación simétrica para las tarjetas
  },
});
