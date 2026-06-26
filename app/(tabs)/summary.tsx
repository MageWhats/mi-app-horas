// app/(tabs)/summary.tsx
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MonthNavigator } from '../../components/MonthNavigator';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SummaryCard } from '../../components/SummaryCard';
import { TabBarIcon } from '../../components/TabBarIcon'; // Cambiado aquí
import { WeeklyBarChart } from '../../components/WeeklyBarChart';
import { useWorkHours } from '../../context/WorkHoursContext';

export default function SummaryScreen() {
  const { summary, currentDate, loading, entries, exportCurrentMonthToCSV } = useWorkHours();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const completionPercentage = totalDaysInMonth > 0 
    ? Math.round((summary.workedDays / totalDaysInMonth) * 100) 
    : 0;

  const hasEntries = Object.keys(entries).length > 0;

  return (
    <ScreenContainer>
      <MonthNavigator />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00b4d8" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          
          <TouchableOpacity
            onPress={exportCurrentMonthToCSV}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#166534',
              paddingVertical: 12,
              borderRadius: 12,
              marginBottom: 16,
              gap: 8,
              borderWidth: 1,
              borderColor: '#15803d'
            }}
          >
            <TabBarIcon name="calendar" size={20} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
              Exportar Reporte a Excel
            </Text>
          </TouchableOpacity>

          <View style={{ backgroundColor: '#1c2541', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#3a4f7c20', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#8d99ae', letterSpacing: 0.5 }}>DÍAS REGISTRADOS</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#00b4d8' }}>{completionPercentage}%</Text>
            </View>
            <View style={{ height: 8, width: '100%', backgroundColor: '#0b132b', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${completionPercentage}%`, backgroundColor: '#00b4d8', borderRadius: 4 }} />
            </View>
            <Text style={{ fontSize: 11, color: '#8d99ae', marginTop: 6 }}>
              Has registrado {summary.workedDays} de {totalDaysInMonth} días totales este mes.
            </Text>
          </View>

          {!hasEntries ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
              <TabBarIcon name="calendar-outline" size={48} color="#1c2541" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#8d99ae', textAlign: 'center', marginBottom: 4, marginTop: 12 }}>
                No hay registros para este mes
              </Text>
              <Text style={{ fontSize: 13, color: '#3a4f7c', textAlign: 'center' }}>
                Ve a la pestaña Registro para comenzar a añadir tus horas.
              </Text>
            </View>
          ) : (
            <>
              <SummaryCard summary={summary} />
              <WeeklyBarChart weeklyHours={summary.weeklyTotals} />
            </>
          )}

        </ScrollView>
      )}
    </ScreenContainer>
  );
}
