// app/(tabs)/summary.tsx
import { Stack } from 'expo-router'; // ¡NUEVO!: Control de cabeceras nativas
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MonthNavigator } from '../../components/MonthNavigator';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SummaryCard } from '../../components/SummaryCard';
import { TabBarIcon } from '../../components/TabBarIcon';
import { WeeklyBarChart } from '../../components/WeeklyBarChart';
import { useWorkHours } from '../../context/WorkHoursContext';

export default function SummaryScreen() {
  const { summary, currentDate, loading, entries, exportCurrentMonthToCSV } = useWorkHours();

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

   // BUSCADOR DE EXCESOS SEMANALES
  const weeklyOvertimeAlerts = Object.entries(summary.weeklyTotals || {}).filter(
    ([,hours]) => (hours as number) > 44
  );

  return (
    <ScreenContainer>
      {/* 1. CONFIGURACIÓN COMPACTA: Oculta la cabecera blanca por defecto en cualquier celular o web */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* 2. TÍTULO INTEGRADO DIRECTAMENTE EN EL AZUL DE TU MAR PROFUNDO */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Resumen</Text>
        

      </View>

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
              borderColor: '#15803d',
              marginTop: 4 // Pequeño ajuste para despegarlo del navegador
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
              Has registrado {totalDaysRegisteredInMonth} de {totalDaysInMonth} días totales este mes.
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
            
              {/* ⚠️ TARJETA DE ALERTA DE JORNADA MÁXIMA DETECTADA */}
              {weeklyOvertimeAlerts.map(([weekName, hours]) => {
                const extraHours = ((hours as number) - 44).toFixed(1);
                return (
                  <View key={weekName} style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#f9731650', marginBottom: 12, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                      <TabBarIcon name="alert-circle" size={16} color="#f97316" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#f97316', letterSpacing: 0.5 }}>ALERTA: JORNADA MÁXIMA EXCEDIDA</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 16 }}>
                      • En la <Text style={{ fontWeight: '700', color: '#ffffff' }}>Semana {Number(weekName) + 1}</Text> trabajaste <Text style={{ fontWeight: '700', color: '#ffffff' }}>{hours}h</Text>. Superaste el límite legal de 44h por ley en Colombia (<Text style={{ fontWeight: '700', color: '#f97316' }}>+{extraHours}h extra</Text>).
                    </Text>
                  </View>
                );
              })}
              <WeeklyBarChart weeklyHours={summary.weeklyTotals} />
            </>
          )}

        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// Estilos de cabecera limpia integrados abajo
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: '#0b132b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#1c2541',
    borderWidth: 1,
    borderColor: '#3a4f7c30',
  }
});
