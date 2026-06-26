// components/MonthNavigator.tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { TabBarIcon } from './TabBarIcon'; // Importación unificada

export const MonthNavigator: React.FC = () => {
  const { currentDate, goToPrevMonth, goToNextMonth } = useWorkHours();
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, backgroundColor: '#0b132b' }}>
      <TouchableOpacity onPress={goToPrevMonth} style={{ padding: 8, borderRadius: 9999, backgroundColor: '#1c2541' }}>
        <TabBarIcon name="chevron-back" size={20} color="#ffffff" />
      </TouchableOpacity>

      <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>
        {months[currentDate.getMonth()]} {currentDate.getFullYear()}
      </Text>

      <TouchableOpacity onPress={goToNextMonth} style={{ padding: 8, borderRadius: 9999, backgroundColor: '#1c2541' }}>
        <TabBarIcon name="chevron-forward" size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
};
