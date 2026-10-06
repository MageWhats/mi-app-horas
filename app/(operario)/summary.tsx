// app/(operario)/summary.tsx
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MonthNavigator } from '../../components/MonthNavigator';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SummaryCard } from '../../components/SummaryCard';
import { TabBarIcon } from '../../components/TabBarIcon';
import { WeeklyBarChart } from '../../components/WeeklyBarChart';
import { useWorkHours } from '../../context/WorkHoursContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { mostrarAlerta } from '../../lib/alert';
import { alpha, useTheme } from '../../lib/theme';

export default function SummaryScreen() {
  const { summary, currentDate, loading, entries, exportCurrentMonth } = useWorkHours();
  const { colors: c } = useTheme();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCurrentMonth();
    } catch (error) {
      console.error('Error generando el reporte de Excel:', error);
      mostrarAlerta('No se pudo generar el reporte de Excel.');
    } finally {
      setExporting(false);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const totalDaysRegisteredInMonth = Object.keys(entries).filter(dateKey => {
    const parts = dateKey.split('-');
    if (parts.length < 2) return false;

    const entryYear = parseInt(parts[0], 10);
    const entryMonth = parseInt(parts[1], 10) - 1; // Ajuste de 1 para el índice del mes
    return entryYear === year && entryMonth === month;
  }).length;

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const completionPercentage = totalDaysInMonth
    ? Math.round((totalDaysRegisteredInMonth / totalDaysInMonth) * 100) 
    : 0;

  const hasEntries = Object.keys(entries).length > 0;

  // Semanas de calendario que superan el límite legal vigente para esa semana (Ley 2101)
  const weeklyOvertimeAlerts = summary.weeklyTotals
    .map((hours, index) => ({ hours, index, limit: summary.weeklyLimits[index], range: summary.weekRanges[index] }))
    .filter(({ hours, limit }) => hours > limit);

  return (
    <ScreenContainer>
      <ScreenHeader title="Resumen" />

      <MonthNavigator />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.cyan} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting || !hasEntries}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.success,
              paddingVertical: 12,
              borderRadius: 12,
              marginBottom: 16,
              gap: 8,
              borderWidth: 1,
              borderColor: c.success,
              marginTop: 4,
              opacity: exporting || !hasEntries ? 0.5 : 1,
            }}
          >
            {exporting ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <>
                <TabBarIcon name="calendar" size={20} color={c.onPrimary} />
                <Text style={{ color: c.onPrimary, fontSize: 15, fontWeight: '700' }}>
                  Exportar Reporte a Excel
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ backgroundColor: c.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.13), marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: c.textMuted, letterSpacing: 0.5 }}>DÍAS REGISTRADOS</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.cyan }}>{completionPercentage}%</Text>
            </View>
            <View style={{ height: 8, width: '100%', backgroundColor: c.bg, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${completionPercentage}%`, backgroundColor: c.cyan, borderRadius: 4 }} />
            </View>
            <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 6 }}>
              Has registrado {totalDaysRegisteredInMonth} de {totalDaysInMonth} días totales este mes.
            </Text>
          </View>

          {!hasEntries ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
              <TabBarIcon name="calendar-outline" size={48} color={c.borderStrong} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: c.textMuted, textAlign: 'center', marginBottom: 4, marginTop: 12 }}>
                No hay registros para este mes
              </Text>
              <Text style={{ fontSize: 13, color: c.textFaint, textAlign: 'center' }}>
                Ve a la pestaña Inicio para comenzar a añadir tus horas.
              </Text>
            </View>
          ) : (
            <>
              <SummaryCard summary={summary} currentDate={currentDate} />
            
              {/* Alerta por semana que supera el límite legal */}
              {weeklyOvertimeAlerts.map(({ hours, index, limit, range }) => {
                const extraHours = (hours - limit).toFixed(1);
                return (
                  <View key={index} style={{ backgroundColor: alpha(c.warning, 0.15), padding: 14, borderRadius: 14, borderWidth: 1, borderColor: alpha(c.warning, 0.31), marginBottom: 12, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                      <TabBarIcon name="alert-circle" size={16} color={c.warning} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: c.warning, letterSpacing: 0.5 }}>ALERTA: JORNADA MÁXIMA EXCEDIDA</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: c.textMuted, lineHeight: 16 }}>
                      • En la <Text style={{ fontWeight: '700', color: c.text }}>Semana {index + 1}</Text> (días {range.from} al {range.to}) trabajaste <Text style={{ fontWeight: '700', color: c.text }}>{hours}h</Text>. Superaste el límite legal de {limit}h por ley en Colombia (<Text style={{ fontWeight: '700', color: c.warning }}>+{extraHours}h extra</Text>).
                    </Text>
                  </View>
                );
              })}
              <WeeklyBarChart weeklyHours={summary.weeklyTotals} weekRanges={summary.weekRanges} />
            </>
          )}

        </ScrollView>
      )}
    </ScreenContainer>
  );
}
