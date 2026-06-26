// components/HoursInputModal.tsx
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { TabBarIcon } from './TabBarIcon'; // Importación de iconos web vectoriales

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

  const handleSave = async () => {
    await saveDayEntry({
      date: dateStr,
      startTime,
      endTime,
      isHolidayOrSunday: isHoliday,
      notes: notes.trim() ? notes : undefined
    } as any);
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
    return `${weekdays[date.getDay()]}, ${day}/${month}`;
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
                <Text style={{ fontSize: 11, color: '#8d99ae', fontWeight: '600', marginBottom: 2, letterSpacing: 0.5 }}>REGISTRO JORNADA</Text>
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

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {hasExistingData && (
                <TouchableOpacity 
                  onPress={handleDelete}
                  style={{ padding: 14, borderRadius: 12, backgroundColor: '#1c2541', borderWidth: 1, borderColor: '#ff007f30' }}
                >
                  <TabBarIcon name="close" size={22} color="#ff007f" />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                onPress={handleSave}
                style={{ flex: 1, backgroundColor: '#3a86ff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Guardar Jornada</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
