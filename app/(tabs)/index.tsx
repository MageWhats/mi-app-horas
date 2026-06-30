// app/(tabs)/index.tsx
import { Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HoursInputModal } from '../../components/HoursInputModal';
import { MonthNavigator } from '../../components/MonthNavigator';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TabBarIcon } from '../../components/TabBarIcon';
import { useWorkHours } from '../../context/WorkHoursContext';

export default function RegisterScreen() {
  const { entries, currentDate } = useWorkHours();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Genera los días del mes seleccionado de forma dinámica
  const generateDaysOfMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysArray = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysArray.push(dateStr);
    }
    return daysArray;
  };

  // Función para capturar la fecha exacta de hoy al presionar el botón flotante
  const openTodayModal = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const renderDayItem = ({ item: dateStr }: { item: string }) => {
    const entry = entries[dateStr];
    const dayDate = new Date(dateStr + 'T00:00:00');
    const dayNumber = dayDate.getDate();
    const weekday = dayDate.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
    const isSunday = dayDate.getDay() === 0;

    const hasLocation = entry && entry.location && typeof entry.location.latitude === 'number';

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c2541', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: entry?.isHolidayOrSunday || isSunday ? '#3a86ff30' : '#3a4f7c15' }}>
        
        {/* Bloque Calendario Izquierda */}
        <View style={{ alignItems: 'center', marginRight: 16, minWidth: 36 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: entry?.isHolidayOrSunday || isSunday ? '#ff007f' : '#8d99ae' }}>{weekday}</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#ffffff' }}>{dayNumber}</Text>
        </View>

        {/* Bloque Detalle de Horas Central */}
        <TouchableOpacity 
          onPress={() => setSelectedDate(dateStr)}
          style={{ flex: 1, justifyContent: 'center' }}
          activeOpacity={0.7}
        >
          {entry ? (
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff', marginBottom: 2 }}>
                {entry.startTime} - {entry.endTime}
              </Text>
              <Text style={{ fontSize: 12, color: '#00b4d8' }}>
                {entry.hours}h totales {entry.nightHours > 0 ? `(${entry.nightHours}h noche)` : ''}
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: '#3a4f7c', fontWeight: '500' }}>Sin registros guardados</Text>
          )}
        </TouchableOpacity>

        {/* Bloque de Acciones Derecha Estilizado */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          
          {hasLocation && (
            <View style={{ padding: 6, borderRadius: 8, backgroundColor: '#0b132b', borderWidth: 1, borderColor: 'rgba(0, 245, 212, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <TabBarIcon name="map" size={14} color="#00f5d4" />
            </View>
          )}

          <TouchableOpacity onPress={() => setSelectedDate(dateStr)} activeOpacity={0.7}>
            <TabBarIcon name="chevron-forward" size={16} color="#3a4f7c" />
          </TouchableOpacity>
        </View>

      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0b132b' }}>
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: false }} />

        
      {/* CABECERA PREMIUM CON BOTÓN DE CERRAR SESIÓN ESTÉTICO */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, paddingBottom: 12, backgroundColor: '#0b132b' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>Registro</Text>
        
      </View>


        <MonthNavigator />
        
         {/* Cambiamos la línea 109 para que cierre correctamente con el signo '>' al final */}
        <FlatList<string>
          data={generateDaysOfMonth()}
          keyExtractor={(item) => item}
          renderItem={renderDayItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
        />

          <HoursInputModal
            isOpen={selectedDate !== null}
            onClose={() => setSelectedDate(null)}
            dateStr={selectedDate}
          />

      </ScreenContainer>

      {/* BOTÓN FLOTANTE "+ HOY" UBICADO PERFECTAMENTE ABAJO A LA DERECHA */}
      <TouchableOpacity 
        onPress={openTodayModal}
        activeOpacity={0.85}
        style={styles.floatingButton}
      >
        <Text style={styles.floatingButtonText}>+ Hoy</Text>
      </TouchableOpacity>
    </View>
  );
}

// 2. EL DICCIONARIO DE ESTILOS QUE HACÍA FALTA ABAJO DEL TODO
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
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#3a86ff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 999,
  },
  floatingButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  }
});
