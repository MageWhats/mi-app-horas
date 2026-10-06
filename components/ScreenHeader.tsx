// components/ScreenHeader.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { LogoHorizontal } from './brand/Logo';
import { ThemeToggle } from './ThemeToggle';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
}

/** Encabezado de las pantallas principales: logo y botón de tema arriba, título (opcional) debajo. */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle }) => {
  const { colors: c } = useTheme();
  return (
    <View style={{ paddingTop: 4, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: title ? 12 : 4 }}>
        <LogoHorizontal height={30} />
        <ThemeToggle />
      </View>
      {!!title && <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }}>{title}</Text>}
      {!!subtitle && <Text style={{ color: c.textMuted, fontSize: 14, marginTop: 2 }}>{subtitle}</Text>}
    </View>
  );
};
