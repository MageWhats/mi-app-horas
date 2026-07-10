// components/HoursInputModal.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { TabBarIcon } from './TabBarIcon';
// ¡AÑADE ESTA IMPORTACIÓN COMPLEMENTARIA!

interface HoursInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
}


export const HoursInputModal: React.FC<HoursInputModalProps> = ({ isOpen, onClose, dateStr }) => {
  const { entries, saveDayEntry, deleteDayEntry } = useWorkHours();


  const [isHoliday, setIsHoliday] = useState(false);
  const [notes, setNotes] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
    // 🔌 LEER MARCAS: Extrae la información y la lista de marcas de este día seleccionado
  const dayData = dateStr ? (entries[dateStr] || null) : null;
  const marcasDelDia = (dayData as any)?.marcas || [];


  useEffect(() => {
    if (isOpen && dateStr) {
      const existingEntry = entries[dateStr];
      if (existingEntry) {
        // Si el día ya tiene datos, cargamos su estado real de Firebase
        setIsHoliday(!!existingEntry.isHolidayOrSunday);
        setNotes(existingEntry.notes || '');
      } else {
        // Si el día está completamente vacío, por defecto el switch arranca apagado
        // y calculamos automáticamente si ese dateStr cae un día Domingo (0)
        const isSunday = new Date(dateStr + 'T00:00:00').getDay() === 0;
        setIsHoliday(isSunday);
        setNotes('');
      }
    }
  }, [isOpen, dateStr, entries]);



  if (!dateStr) return null;


  const handleSave = async () => {
    if (!dateStr) return;
    setGpsLoading(true);

    try {
      // 1. Jalamos con total seguridad el registro actual directamente de tu estado 'entries'
      const existingEntry = (entries as any)[dateStr] || {};
      
      // 2. Extraemos las horas y las marcas que ya calculó el botón gigante para no perderlas
      const horasReales = existingEntry.hours !== undefined ? existingEntry.hours : 0;
      const marcasReales = existingEntry.marcas || [];

      // 3. CONSERVACIÓN ABSOLUTA: Armamos el paquete asegurando que las horas y las marcas se mantengan intactas
      const updatedPayload = {
        ...existingEntry,          // Hereda los campos base (userId, yearMonth, etc.)
        date: dateStr,
        hours: horasReales,        // ⏱️ ¡OBLIGATORIO! Mantiene el acumulado real de las fracciones
        marcas: marcasReales,      // 🕒 ¡OBLIGATORIO! Protege la lista de ponchadas para que no se borren
        isHolidayOrSunday: isHoliday,
        notes: notes.trim() ? notes : null,
      };

      // 4. Mandamos el paquete purificado a tu función nativa de Firebase
      await saveDayEntry(updatedPayload as any);

      alert('¡Hoja de ruta actualizada con éxito, mi rey! 🌟');
      onClose();

    } catch (error) {
      console.error("Error al guardar cambios de auditoría:", error);
      alert('No se pudieron salvar los cambios. Revisa tu red.');
    } finally {
      setGpsLoading(false);
    }
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

            
            {/* 🕒 PANEL DE AUDITORÍA: Línea de tiempo real con GPS */}
            <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 10, fontWeight: '700', letterSpacing: 0.5 }}>
              FRACCIONES DE JORNADA REGISTRADAS
            </Text>

            {marcasDelDia.length === 0 ? (
              <View style={{ backgroundColor: '#1c254130', padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#3a4f7c15', marginBottom: 20 }}>
                <Text style={{ color: '#4f5d75', fontSize: 13, fontStyle: 'italic', textAlign: 'center' }}>
                  No se encontraron marcas automáticas registradas en este día.
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#1c254140', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#3a4f7c15', marginBottom: 20, gap: 10 }}>
                {marcasDelDia.map((punch: any, idx: number) => {
                  const esEntrada = punch.tipo === 'ENTRADA';
                  const esManual = punch.tipo === 'MANUAL';
                  const horaConSegundos = punch.hora ? punch.hora.toLowerCase() : '';
                  
                  return (
                    <View key={punch.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#11193660', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#3a4f7c10' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ 
                          paddingHorizontal: 8, 
                          paddingVertical: 3, 
                          borderRadius: 6, 
                          backgroundColor: esManual ? 'rgba(58, 134, 255, 0.08)' : esEntrada ? 'rgba(0, 245, 212, 0.08)' : 'rgba(255, 0, 127, 0.08)', 
                          borderWidth: 1, 
                          borderColor: esManual ? 'rgba(58, 134, 255, 0.2)' : esEntrada ? 'rgba(0, 245, 212, 0.2)' : 'rgba(255, 0, 127, 0.2)' 
                        }}>
                          <Text style={{ color: esManual ? '#3a86ff' : esEntrada ? '#00f5d4' : '#ff007f', fontSize: 9, fontWeight: '800' }}>
                            {punch.tipo}
                          </Text>
                        </View>
                        {/* Imprime la hora con la precisión exacta de segundos en el modal */}
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                          {horaConSegundos}
                        </Text>
                      </View>
                      
                      {!esManual && punch.latitude && (
                        <Text style={{ color: '#4f5d75', fontSize: 11 }}>
                          📍 Precisión: {punch.accuracy ? `${Math.round(punch.accuracy)}m` : 'OK'}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}



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



