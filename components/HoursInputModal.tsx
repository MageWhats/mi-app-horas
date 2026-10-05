// components/HoursInputModal.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { confirmar, mostrarAlerta } from '../lib/alert';
import { getRecargoDominical } from '../lib/utils';
import { Marca } from '../types/hours';
import { TabBarIcon } from './TabBarIcon';

interface HoursInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
}

export const HoursInputModal: React.FC<HoursInputModalProps> = ({ isOpen, onClose, dateStr }) => {
  const { entries, updateDayDetails, deleteDayEntry } = useWorkHours();
  const [isHoliday, setIsHoliday] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const dayData = dateStr ? (entries[dateStr] || null) : null;
  const marcasDelDia: Marca[] = dayData?.marcas ?? [];

  // Los días con registro manual quedan fijados: festivo y notas se definieron al crearlos
  const tipoIngresoDia = dayData?.tipoIngreso || '';
  const tieneMarcasManuales = marcasDelDia.some((m) => m.tipo === 'MANUAL' || m.tipo === 'MANUAL_JORNADA');
  
  // Candado de seguridad: Se activa si Firestore dice que es MANUAL o si contiene marcas manuales
  const esRegistroManual = tipoIngresoDia === 'MANUAL' || tipoIngresoDia === 'MANUAL_JORNADA' || tieneMarcasManuales;

  // Carga el formulario solo al abrir: así una actualización en vivo no borra lo que se está escribiendo
  useEffect(() => {
    if (isOpen && dateStr) {
      const existingEntry = entries[dateStr];
      if (existingEntry) {
        setIsHoliday(!!existingEntry.isHolidayOrSunday);
        setNotes(existingEntry.notes || '');
      } else {
        // Día vacío: el switch arranca encendido solo si la fecha cae en domingo
        setIsHoliday(new Date(dateStr + 'T00:00:00').getDay() === 0);
        setNotes('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dateStr]);

  if (!dateStr) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDayDetails(dateStr, { isHolidayOrSunday: isHoliday, notes: notes.trim() || null });
      mostrarAlerta('Jornada actualizada');
      onClose();
    } catch (error) {
      console.error('Error al guardar la jornada:', error);
      mostrarAlerta('No se pudieron guardar los cambios', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmar('Eliminar jornada', 'Se borrarán todas las marcas y horas de este día. Esta acción no se puede deshacer.', 'Eliminar');
    if (!ok) return;

    setSaving(true);
    try {
      await deleteDayEntry(dateStr);
      onClose();
    } catch (error) {
      console.error('Error eliminando la jornada:', error);
      mostrarAlerta('No se pudo eliminar el registro del día.');
    } finally {
      setSaving(false);
    }
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

            {/* PANEL DE AUDITORÍA: Línea de tiempo real con GPS */}
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
                {marcasDelDia.map((punch, idx) => {
                  const esEntrada = punch.tipo === 'ENTRADA';
                  const esManual = punch.tipo === 'MANUAL' || punch.tipo === 'MANUAL_JORNADA';
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
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                          {horaConSegundos}
                        </Text>
                      </View>
                      {!esManual && punch.latitude && (
                        <Text style={{ color: '#4f5d75', fontSize: 11 }}>
                          Precisión: {punch.accuracy ? `${Math.round(punch.accuracy)}m` : 'OK'}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* INTERRUPTOR DE DOMINGO / FESTIVO CONDICIONADO */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1c2541', padding: 14, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#3a4f7c20', opacity: esRegistroManual ? 0.5 : 1 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '500', marginBottom: 2 }}>¿Es Domingo o Festivo?</Text>
                <Text style={{ fontSize: 11, color: '#8d99ae' }}>
                  {esRegistroManual ? 'Bloqueado: Administrado desde registro manual.' : `Aplica el recargo dominical/festivo (+${getRecargoDominical(dateStr)}% vigente para esta fecha).`}
                </Text>
              </View>
              <Switch 
                disabled={esRegistroManual} // Candado 1: Apaga el switch si es manual
                value={isHoliday} 
                onValueChange={setIsHoliday} 
                trackColor={{ false: '#0b132b', true: '#3a86ff40' }} 
                thumbColor={isHoliday ? '#3a86ff' : '#8d99ae'} 
              />
            </View>

            {/* CUADRO DE TEXTO DE NOTAS CONDICIONADO */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, color: '#8d99ae', marginBottom: 8, fontWeight: '500' }}>Notas / Actividades</Text>
              <TextInput
                editable={!esRegistroManual} // Candado 2: Se vuelve de solo lectura si es manual
                value={notes} 
                onChangeText={setNotes} 
                placeholder={esRegistroManual ? "Notas fijadas en registro manual." : "Escribe aquí las novedades del día..."} 
                placeholderTextColor="#3a4f7c" 
                multiline={true} 
                numberOfLines={2} 
                style={{ backgroundColor: '#1c2541', color: esRegistroManual ? '#4f5d75' : '#ffffff', padding: 14, borderRadius: 12, fontSize: 15, minHeight: 64, textAlignVertical: 'top', borderWidth: 1, borderColor: '#3a4f7c40', opacity: esRegistroManual ? 0.6 : 1 }} 
              />
            </View>

            {saving && (
              <Text style={{ color: '#00b4d8', fontSize: 12, textAlign: 'center', marginBottom: 12, fontWeight: '500' }}>
                Guardando cambios...
              </Text>
            )}

            {/* BOTONERA DE ACCIÓN CONDICIONADA */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              {hasExistingData && (
                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={saving}
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1c2541', borderWidth: 1, borderColor: '#ff007f30', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#ff6b92', fontSize: 15, fontWeight: '600' }}>Eliminar</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || esRegistroManual} // Candado 3: Inhabilita por completo el clic si es manual
                style={{ 
                  flex: 1, 
                  backgroundColor: esRegistroManual ? '#161e38' : saving ? '#1c2541' : '#3a86ff', 
                  paddingVertical: 14, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  opacity: esRegistroManual ? 0.4 : 1 
                }}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: esRegistroManual ? '#4f5d75' : '#ffffff', fontSize: 16, fontWeight: '600' }}>
                    {esRegistroManual ? 'Fijado Manual' : 'Guardar Jornada'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

