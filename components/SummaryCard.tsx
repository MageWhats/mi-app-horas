// components/SummaryCard.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { getFranjaNocturnaLabel, getRecargoDominical, toLocalDateStr } from '../lib/utils';
import { MonthlySummary } from '../types/hours';
import { TabBarIcon } from './TabBarIcon';
import { alpha, useTheme } from '../lib/theme'; // Conectado al nuevo sistema vectorial

interface SummaryCardProps {
  summary: MonthlySummary;
  currentDate: Date;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary, currentDate }) => {
  const { colors: c } = useTheme();
  // Las reglas legales se muestran con la vigencia del último día del mes visualizado
  const cierreMes = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));

  const renderMetricItem = (title: string, value: string | number, subtext: string, iconName: string, iconColor: string) => (
    <View style={{ flex: 1, minWidth: '45%', backgroundColor: c.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.13), margin: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: c.textMuted }}>{title.toUpperCase()}</Text>
        <TabBarIcon name={iconName} size={16} color={iconColor} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 2 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: c.textMuted }}>{subtext}</Text>
    </View>
  );

  return (
    <View style={{ marginVertical: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        
        {renderMetricItem('Horas Reales', `${summary.totalHours}h`, 'Tiempo neto laborado', 'time-outline', c.cyan)}
        
        {renderMetricItem('Con Recargo', `${summary.totalHoursWithRecargo}h`, `Domingos / festivos (+${getRecargoDominical(cierreMes)}%)`, 'calculator-outline', c.primary)}
        
        {renderMetricItem('Días Activos', summary.workedDays, 'Jornadas registradas', 'calendar-outline', c.cyan)}
        
        {renderMetricItem('Promedio Diario', `${summary.averageHoursPerDay}h`, 'Media por jornada', 'analytics-outline', '#9b5de5')}

        {renderMetricItem('Recargo Noct.', `${summary.totalRecargoNocturno}h`, `Horas de ${getFranjaNocturnaLabel(cierreMes)}`, 'moon-outline', c.warning)}

        {renderMetricItem('Horas Extras', `${summary.totalHorasExtras}h`, 'Excesos diarios > 7.5h', 'trending-up-outline', c.danger)}

      </View>

      <View style={{ backgroundColor: c.surfaceAlt, padding: 12, borderRadius: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.border }}>
        <TabBarIcon name="information-circle-outline" size={18} color={c.textMuted} />
        <Text style={{ fontSize: 11, color: c.textMuted, flex: 1, lineHeight: 14 }}>
          Configuración actual: Tope diario ordinario de <Text style={{ fontWeight: '700', color: c.text }}>7.5 horas</Text>. El límite ordinario legal semanal para este período se calcula en <Text style={{ fontWeight: '700', color: c.text }}>{summary.weeklyLimit} horas</Text> según la Ley Colombiana.
        </Text>
      </View>
    </View>
  );
};
