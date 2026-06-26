// components/HoursInputModal.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { TabBarIcon } from './TabBarIcon';

interface HoursInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
}

export const HoursInputModal: React.FC<HoursInputModalProps> = ({ isOpen, onClose, dateStr }) => {
  if (!dateStr) return null;

  const { entries, saveDayEntry, deleteDayEntry } = useWorkHours();

  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isHoliday, setIsHoliday] = useState(false);
  const [notes, setNotes] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false); // Estado para mostrar carga de GPS

  useEffect(() => {
    if (isOpen && dateStr) {
      const existingEntry = entries[dateStr];
      if (existingEntry) {
        setStartTime(existingEntry.startTime);
        setEndTime(existingEntry.endTime);
        setIsHoliday(existingEntry.isHolidayOrSunday);
        setNotes(existingEntry.notes || '');
      } else {
        setStartTime('08:00');
        setEndTime('17:00');
        const isSunday = new Date(dateStr + 'T00:00:00').getDay() === 0;
        setIsHoliday(isSunday);
        setNotes('');
      }
    }
  }, [isOpen, dateStr, entries]);

  // Función interna para solicitar coordenadas al navegador o celular de forma nativa
  const captureCurrentLocation = (): Promise<any> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.log("Geolocalización no soportada por el navegador.");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          console.log("Error o rechazo de permisos de GPS:", error.message);
          resolve(null); // Retorna nulo pero no rompe el flujo de guardado
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } // Configuración de alta precisión
      );
    });
  };

  const handleSave = async () => {
    setGpsLoading(true);
    
    // Captura la ubicación en caliente justo al presionar el botón
    const coords = await captureCurrentLocation();

    await saveDayEntry({
      date: dateStr,
      startTime,
      endTime,
      isHolidayOrSunday: isHoliday,
      notes: notes.trim() ? notes : undefined,
      location: coords || undefined // Inyectamos el objeto de ubicación si se capturó con éxito
    } as any);

    setGpsLoading(false);
    onClose();
  };

  const handleDelete = async () => {
    await deleteDayEntry(dateStr);
    onClose();
  };

  const formatFriendlyDate = (str: string) => {
    const date = new Date(str + 'T00:00:00');
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const [, month, day] = str.split('-');
    return `${weekdays[date.getDay()]} ${day}/${month}`;
  };

  const hasExistingData = !!entries[dateStr];

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={{ backgroundColor: '#0b132b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, maxHeight: '85%', borderWidth: 1, borderColor: '#1c2541' }}>
          
          <View style={{ width: 45, height: 4, backgroundColor: '#1c2541', borderRadius: 2, alignSelf: 'center', marginVertical: 14 }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 11, color: '#8d99ae', fontWeight: '600', marginBottom: 2, letterSpacing: 0.5 }}>REGISTRO JORNADA + GPS</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff' }}>{formatFriendlyDate(dateStr)}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 6, borderRadius: 9999, backgroundColor: '#1c2541' }}>
                <TabBarIcon name="close" size={20} color="#8d99ae" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 8, fontWeight: '500' }}>Hora Entrada</Text>
                <TextInput 
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  placeholderTextColor="#3a4f7c"
                  maxLength={5}
                  style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: '#3a4f7c40' }}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 8, fontWeight: '500' }}>Hora Salida</Text>
                <TextInput 
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="17:00"
                  placeholderTextColor="#3a4f7c"
                  maxLength={5}
                  style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 16, textAlign: 'center', borderWidth: 1, borderColor: '#3a4f7c40' }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1c2541', padding: 14, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#3a4f7c20' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '500', marginBottom: 2 }}>¿Es Domingo o Festivo?</Text>
                <Text style={{ fontSize: 11, color: '#8d99ae' }}>Aplica recargo exclusivo del +75% a la tarjeta correspondiente.</Text>
              </View>
              <Switch 
                value={isHoliday} 
                onValueChange={setIsHoliday}
                trackColor={{ false: '#0b132b', true: '#3a86ff40' }}
                thumbColor={isHoliday ? '#3a86ff' : '#8d99ae'}
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 8, fontWeight: '500' }}>Notas / Actividades</Text>
              <TextInput 
                value={notes}
                onChangeText={setNotes}
                placeholder="Escribe aquí las novedades del día..."
                placeholderTextColor="#3a4f7c"
                multiline={true}
                numberOfLines={2}
                style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 15, minHeight: 64, textAlignVertical: 'top', borderWidth: 1, borderColor: '#3a4f7c40' }}
              />
            </View>

            {/* Muestra un pequeño indicador de texto si se está cargando la ubicación */}
            {gpsLoading && (
              <Text style={{ color: '#00b4d8', fontSize: 12, textAlign: 'center', marginBottom: 12, fontWeight: '500' }}>
                Consultando satélites GPS de forma segura...
              </Text>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {hasExistingData && (
                <TouchableOpacity 
                  onPress={handleDelete}
                  disabled={gpsLoading}
                  style={{ padding: 14, borderRadius: 12, backgroundColor: '#1c2541', borderWidth: 1, borderColor: '#ff007f30' }}
                >
                  <TabBarIcon name="close" size={22} color="#ff007f" />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                onPress={handleSave}
                disabled={gpsLoading}
                style={{ flex: 1, backgroundColor: gpsLoading ? '#1c2541' : '#3a86ff', paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                activeOpacity={0.85}
              >
                {gpsLoading ? (
                  <ActivityIndicator color="#00b4d8" />
                ) : (
                  <>
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Guardar Jornada</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
