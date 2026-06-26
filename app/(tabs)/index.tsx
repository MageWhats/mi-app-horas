// app/(tabs)/index.tsx
import { TabBarIcon } from '@/components/TabBarIcon';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { HoursInputModal } from '../../components/HoursInputModal';
import { MonthNavigator } from '../../components/MonthNavigator';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useWorkHours } from '../../context/WorkHoursContext';
import { DayEntry } from '../../types/hours';


export default function RegisterScreen() {
  const { entries, currentDate, loading } = useWorkHours();
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleOpenTodayModal = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    // Abre el modal pasándole la fecha exacta del día de hoy
    setSelectedDateStr(`${yyyy}-${mm}-${dd}`);
    setIsModalOpen(true);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const generateDaysOfMonth = () => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const daysArray: { dateStr: string; dayNum: number; dayName: string }[] = [];
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d);
      daysArray.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        dayName: weekdays[dateObj.getDay()]
      });
    }
    return daysArray;
  };

  return (
    <ScreenContainer>
      <MonthNavigator />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00b4d8" />
        </View>
      ) : (
        <FlatList
          data={generateDaysOfMonth()}
          keyExtractor={(item) => item.dateStr}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const savedEntry: DayEntry | undefined = entries[item.dateStr];
            const isSunday = new Date(item.dateStr + 'T00:00:00').getDay() === 0;
            const isHighlighted = savedEntry?.isHolidayOrSunday || isSunday;

            return (
              <TouchableOpacity
                onPress={() => { setSelectedDateStr(item.dateStr); setIsModalOpen(true); }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: '#1c2541',
                  borderRadius: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: isHighlighted ? '#3a86ff' : '#233dff20'
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ alignItems: 'center', marginRight: 16, width: 36 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: isHighlighted ? '#ff007f' : '#ffffff' }}>
                      {String(item.dayNum).padStart(2, '0')}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#8d99ae', fontWeight: '500' }}>
                      {item.dayName}
                    </Text>
                  </View>

                  <View>
                    {savedEntry ? (
                      <>
                        <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '500' }}>
                          {savedEntry.startTime} - {savedEntry.endTime}
                        </Text>
                        {savedEntry.notes ? (
                          <Text numberOfLines={1} style={{ fontSize: 12, color: '#8d99ae', marginTop: 2, maxWidth: 180 }}>
                            {savedEntry.notes}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={{ fontSize: 14, color: '#3a4f7c' }}>—</Text>
                    )}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {savedEntry ? (
                    <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#00b4d8' }}>
                        {savedEntry.hours}h
                      </Text>
                      {savedEntry.isHolidayOrSunday ? (
                        <Text style={{ fontSize: 10, color: '#3a86ff', fontWeight: '500' }}>
                          +75% Recargo
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <TabBarIcon name="chevron-forward" size={16} color="#3a4f7c" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

                {/* Botón Flotante "+ Hoy" estilo Mar Profundo */}
          <TouchableOpacity
            onPress={handleOpenTodayModal}
            activeOpacity={0.85}
            style={{
              position: 'absolute',
              bottom: 24,
              right: 16,
              backgroundColor: '#3a86ff', // El azul brillante de tu diseño
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 4.65,
              elevation: 8, // Sombra para Android
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
              + Hoy
            </Text>
          </TouchableOpacity>


      {isModalOpen && selectedDateStr && (
        <HoursInputModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} dateStr={selectedDateStr} />
      )}
    </ScreenContainer>
  );
}

