// components/SummaryCard.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { MonthlySummary } from '../types/hours';
import { TabBarIcon } from './TabBarIcon'; // Conectado al nuevo sistema vectorial

interface SummaryCardProps {
  summary: MonthlySummary;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary }) => {
  const renderMetricItem = (title: string, value: string | number, subtext: string, iconName: string, iconColor: string) => (
    <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#1c2541', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#3a4f7c20', margin: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#8d99ae' }}>{title.toUpperCase()}</Text>
        <TabBarIcon name={iconName} size={16} color={iconColor} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 2 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#8d99ae' }}>{subtext}</Text>
    </View>
  );

  return (
    <View style={{ marginVertical: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        
        {renderMetricItem('Horas Reales', `${summary.totalHours}h`, 'Tiempo neto laborado', 'time-outline', '#00b4d8')}
        
        {renderMetricItem('Con Recargo', `${summary.totalHoursWithRecargo}h`, 'Solo domingos / festivos', 'calculator-outline', '#3a86ff')}
        
        {renderMetricItem('Días Activos', summary.workedDays, 'Jornadas registradas', 'calendar-outline', '#00f5d4')}
        
        {renderMetricItem('Promedio Diario', `${summary.averageHoursPerDay}h`, 'Media por jornada', 'analytics-outline', '#9b5de5')}

        {renderMetricItem('Recarga Noct.', `${summary.totalRecargoNocturno}h`, 'Equivalente +35% legal', 'moon-outline', '#f59e0b')}

        {renderMetricItem('Horas Extras', `${summary.totalHorasExtras}h`, 'Excesos diarios > 7.5h', 'trending-up-outline', '#ff007f')}

      </View>

      <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#1e293b' }}>
        <TabBarIcon name="information-circle-outline" size={18} color="#8d99ae" />
        <Text style={{ fontSize: 11, color: '#8d99ae', flex: 1, lineHeight: 14 }}>
          Configuración actual: Tope diario ordinario de <Text style={{ fontWeight: '700', color: '#ffffff' }}>7.5 horas</Text>. El límite ordinario legal semanal para este período se calcula en <Text style={{ fontWeight: '700', color: '#ffffff' }}>{summary.weeklyLimit} horas</Text> según la Ley Colombiana.
        </Text>
      </View>
    </View>
  );
};
