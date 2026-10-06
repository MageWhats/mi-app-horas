// components/ThemeToggle.tsx
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { alpha, useTheme } from '../lib/theme';
import { TabBarIcon } from './TabBarIcon';

/** Botón para cambiar entre tema claro y oscuro. Con `conTexto` muestra también la etiqueta. */
export const ThemeToggle: React.FC<{ conTexto?: boolean }> = ({ conTexto = false }) => {
  const { esOscuro, colors, alternarTema } = useTheme();
  const etiqueta = esOscuro ? 'Tema claro' : 'Tema oscuro';

  return (
    <TouchableOpacity
      onPress={alternarTema}
      accessibilityRole="button"
      accessibilityLabel={`Cambiar a ${etiqueta.toLowerCase()}`}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: conTexto ? 14 : 10, paddingVertical: 10, borderRadius: 12,
        backgroundColor: alpha(colors.primary, esOscuro ? 0.14 : 0.08),
        borderWidth: 1, borderColor: alpha(colors.primary, 0.25),
      }}
    >
      <TabBarIcon name={esOscuro ? 'sunny' : 'moon'} size={18} color={esOscuro ? '#fbbf24' : colors.primary} />
      {conTexto && <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{etiqueta}</Text>}
    </TouchableOpacity>
  );
};
