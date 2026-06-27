// app/(tabs)/index.tsx
import { useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
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

  const renderDayItem = ({ item: dateStr }: { item: string }) => {
    const entry = entries[dateStr];
    const dayDate = new Date(dateStr + 'T00:00:00');
    const dayNumber = dayDate.getDate();
    const weekday = dayDate.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
    const isSunday = dayDate.getDay() === 0;

    // Validación estricta para saber si el registro tiene guardada la ubicación GPS
    const hasLocation = entry && entry.location && typeof entry.location.latitude === 'number';

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c2541', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: entry?.isHolidayOrSunday || isSunday ? '#3a86ff30' : '#3a4f7c15' }}>
        
        {/* Bloque Calendario Izquierda - SIEMPRE VISIBLE */}
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
          
          {/* INDICADOR VISUAL MAPA: Sello estático discreto al costado derecho */}
          {hasLocation && (
            <View 
              style={{ 
                padding: 6, 
                borderRadius: 8, 
                backgroundColor: '#0b132b', 
                borderWidth: 1, 
                borderColor: 'rgba(0, 245, 212, 0.2)',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
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
    <ScreenContainer>
      <MonthNavigator />
      
      <FlatList
        data={generateDaysOfMonth()}
        keyExtractor={(item) => item}
        renderItem={renderDayItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <HoursInputModal 
        isOpen={selectedDate !== null} 
        onClose={() => setSelectedDate(null)} // CORRECCIÓN: Agregar 'onClose'
        dateStr={selectedDate} 
      />

    </ScreenContainer>
  );
}

