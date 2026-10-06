// components/MonthNavigator.tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { alpha, useTheme } from '../lib/theme';
import { TabBarIcon } from './TabBarIcon';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const MonthNavigator: React.FC = () => {
  const { currentDate, goToPrevMonth, goToNextMonth } = useWorkHours();
  const { colors: c } = useTheme();

  const boton = (onPress: () => void, icono: string, etiqueta: string) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={etiqueta}
      hitSlop={6}
      style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(c.primary, 0.1) }}
    >
      <TabBarIcon name={icono} size={20} color={c.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 6, marginVertical: 8,
      backgroundColor: c.surface, borderRadius: 24, borderWidth: 1, borderColor: c.border,
    }}>
      {boton(goToPrevMonth, 'chevron-back', 'Mes anterior')}
      <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>
        {MESES[currentDate.getMonth()]} {currentDate.getFullYear()}
      </Text>
      {boton(goToNextMonth, 'chevron-forward', 'Mes siguiente')}
    </View>
  );
};
