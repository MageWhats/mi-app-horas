// components/HoursInputModal.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { TabBarIcon } from './TabBarIcon';

interface HoursInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
}

// Opciones de Horas (00-23) y Minutos (00-59)
const hoursOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutesOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export const HoursInputModal: React.FC<HoursInputModalProps> = ({ isOpen, onClose, dateStr }) => {
  if (!dateStr) return null;

  const { entries, saveDayEntry, deleteDayEntry } = useWorkHours();

  const [startH, setStartH] = useState('08');
  const [startM, setStartM] = useState('00');
  const [endH, setEndH] = useState('17');
  const [endM, setEndM] = useState('00');
  
  const [isHoliday, setIsHoliday] = useState(false);
  const [notes, setNotes] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && dateStr) {
      const existingEntry = entries[dateStr];
      if (existingEntry) {
        const [sh, sm] = existingEntry.startTime.split(':');
        const [eh, em] = existingEntry.endTime.split(':');
        setStartH(sh || '08');
        setStartM(sm || '00');
        setEndH(eh || '17');
        setEndM(em || '00');
        setIsHoliday(existingEntry.isHolidayOrSunday);
        setNotes(existingEntry.notes || '');
      } else {
        setStartH('08');
        setStartM('00');
        setEndH('17');
        setEndM('00');
        const isSunday = new Date(dateStr + 'T00:00:00').getDay() === 0;
        setIsHoliday(isSunday);
        setNotes('');
      }
    }
  }, [isOpen, dateStr, entries]);

  const captureCurrentLocation = (): Promise<any> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: parseFloat(position.coords.latitude.toFixed(5)),
            longitude: parseFloat(position.coords.longitude.toFixed(5)),
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleSave = async () => {
    setGpsLoading(true);
    const coords = await captureCurrentLocation();

    const startTimeFormatted = `${startH}:${startM}`;
    const endTimeFormatted = `${endH}:${endM}`;

    await saveDayEntry({
      date: dateStr,
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
      isHolidayOrSunday: isHoliday,
      notes: notes.trim() ? notes : undefined,
      location: coords || undefined
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

            
            {/* SECCIÓN SELECTORES DOBLES UNIVERSALES OPTIMIZADOS */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              
              {/* Bloque Selector Hora Entrada */}
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 8, fontWeight: '500' }}>Hora Entrada</Text>
                {Platform.OS === 'web' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <select 
                      value={startH} 
                      onChange={(e) => setStartH(e.target.value)} 
                      style={{ flex: 1, backgroundColor: '#1c2541', color: '#ffffff', padding: '14px 0px', borderRadius: '12px', fontSize: '16px', border: '1px solid rgba(58, 79, 124, 0.4)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textAlign: 'center', textAlignLast: 'center' as any }}
                    >
                      {hoursOptions.map((h) => <option key={`sh-${h}`} value={h} style={{ backgroundColor: '#0b132b' }}>{h}</option>)}
                    </select>
                    <Text style={{ color: '#3a4f7c', fontWeight: '700', fontSize: 18 }}>:</Text>
                    <select 
                      value={startM} 
                      onChange={(e) => setStartM(e.target.value)} 
                      style={{ flex: 1, backgroundColor: '#1c2541', color: '#ffffff', padding: '14px 0px', borderRadius: '12px', fontSize: '16px', border: '1px solid rgba(58, 79, 124, 0.4)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textAlign: 'center', textAlignLast: 'center' as any }}
                    >
                      {minutesOptions.map((m) => <option key={`sm-${m}`} value={m} style={{ backgroundColor: '#0b132b' }}>{m}</option>)}
                    </select>
                  </View>
                ) : (
                  // EN CELULARES: Evita colapsos de interfaz mostrando el tiempo de forma estable
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flex: 1, backgroundColor: '#1c2541', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#3a4f7c40', alignItems: 'center' }}>
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{startH}:{startM}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Bloque Selector Hora Salida */}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 8, fontWeight: '500' }}>Hora Salida</Text>
                {Platform.OS === 'web' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <select 
                      value={endH} 
                      onChange={(e) => setEndH(e.target.value)} 
                      style={{ flex: 1, backgroundColor: '#1c2541', color: '#ffffff', padding: '14px 0px', borderRadius: '12px', fontSize: '16px', border: '1px solid rgba(58, 79, 124, 0.4)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textAlign: 'center', textAlignLast: 'center' as any }}
                    >
                      {hoursOptions.map((h) => <option key={`eh-${h}`} value={h} style={{ backgroundColor: '#0b132b' }}>{h}</option>)}
                    </select>
                    <Text style={{ color: '#3a4f7c', fontWeight: '700', fontSize: 18 }}>:</Text>
                    <select 
                      value={endM} 
                      onChange={(e) => setEndM(e.target.value)} 
                      style={{ flex: 1, backgroundColor: '#1c2541', color: '#ffffff', padding: '14px 0px', borderRadius: '12px', fontSize: '16px', border: '1px solid rgba(58, 79, 124, 0.4)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textAlign: 'center', textAlignLast: 'center' as any }}
                    >
                      {minutesOptions.map((m) => <option key={`em-${m}`} value={m} style={{ backgroundColor: '#0b132b' }}>{m}</option>)}
                    </select>
                  </View>
                ) : (
                  // EN CELULARES: Diseño seguro para la salida ordinaria
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flex: 1, backgroundColor: '#1c2541', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#3a4f7c40', alignItems: 'center' }}>
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{endH}:{endM}</Text>
                    </View>
                  </View>
                )}
              </View>

            </View>


            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1c2541', padding: 14, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#3a4f7c20' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '500', marginBottom: 2 }}>¿Es Domingo o Festivo?</Text>
                <Text style={{ fontSize: 11, color: '#8d99ae' }}>Aplica recargo exclusivo del +75% a la tarjeta correspondiente.</Text>
              </View>
              <Switch value={isHoliday} onValueChange={setIsHoliday} trackColor={{ false: '#0b132b', true: '#3a86ff40' }} thumbColor={isHoliday ? '#3a86ff' : '#8d99ae'} />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 8, fontWeight: '500' }}>Notes / Actividades</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Escribe aquí las novedades del día..." placeholderTextColor="#3a4f7c" multiline={true} numberOfLines={2} style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 15, minHeight: 64, textAlignVertical: 'top', borderWidth: 1, borderColor: '#3a4f7c40' }} />
            </View>
            {gpsLoading && (
              <Text style={{ color: '#00b4d8', fontSize: 12, textAlign: 'center', marginBottom: 12, fontWeight: '500' }}>
                Sincronizando satélites y guardando en Firebase...
              </Text>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              {hasExistingData && (
                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={gpsLoading}
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1c2541', borderWidth: 1, borderColor: '#ff007f30', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#ff6b92', fontSize: 15, fontWeight: '600' }}>Eliminar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleSave}
                disabled={gpsLoading}
                style={{ flex: 1, backgroundColor: gpsLoading ? '#1c2541' : '#3a86ff', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.85}
              >
                {gpsLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Guardar Jornada</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pickerContainer: {
    flex: 1,
    backgroundColor: '#1c2541',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(58, 79, 124, 0.4)',
    overflow: 'hidden',
    justifyContent: 'center',
    height: 50,
  },
  picker: {
    width: '100%',
    color: '#ffffff',
    backgroundColor: '#1c2541', // Forzamos el fondo azul oscuro marino en el selector
    fontSize: 16,
    ...Platform.select({
      web: {
        outline: 'none',
        border: 'none',
        padding: '0px',
        cursor: 'pointer',
        textAlign: 'center',
        textAlignLast: 'center', // ¡CLAVE UNIVERSAL! Fuerza al navegador web a centrar el número seleccionado
        appearance: 'none', // Remueve las flechas nativas feas para limpiar el diseño
        WebkitAppearance: 'none',
        MozAppearance: 'none',
      } as any
    })
  }
});



