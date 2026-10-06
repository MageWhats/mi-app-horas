// components/ScreenContainer.tsx
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Paleta, useThemedStyles } from '../lib/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(crearEstilos);

  return (
    <View
      style={[
        styles.container,
        {
          // Respeta el notch del teléfono; en la web basta un margen pequeño
          paddingTop: Platform.OS === 'web' ? 8 : Math.max(insets.top, 8),
          paddingBottom: Platform.OS === 'web' ? 0 : insets.bottom,
        },
      ]}
    >
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const crearEstilos = (c: Paleta) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { flex: 1, paddingHorizontal: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
