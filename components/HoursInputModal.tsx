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
import { alpha, useTheme } from '../lib/theme';

interface HoursInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
}

export const HoursInputModal: React.FC<HoursInputModalProps> = ({ isOpen, onClose, dateStr }) => {
  const { colors: c } = useTheme();
  const { entries, updateDayDetails, deleteDayEntry } = useWorkHours();
  const [isHoliday, setIsHoliday] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const dayData = dateStr ? (entries[dateStr] || null) : null;
  const marcasDelDia: Marca[] = dayData?.marcas ?? [];

  // Los días con registro manual quedan fijados: festivo y notas se definieron al crearlos
  const esRegistroManual = marcasDelDia.some((m) => m.tipo === 'MANUAL' || m.tipo === 'MANUAL_JORNADA');

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
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, maxHeight: '85%', borderWidth: 1, borderColor: c.surface }}>
          <View style={{ width: 45, height: 4, backgroundColor: c.surface, borderRadius: 2, alignSelf: 'center', marginVertical: 14 }} />
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: '600', marginBottom: 2, letterSpacing: 0.5 }}>REGISTRO JORNADA + GPS</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{formatFriendlyDate(dateStr)}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 6, borderRadius: 9999, backgroundColor: c.surface }}>
                <TabBarIcon name="close" size={20} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Marcas del día */}
            <Text style={{ fontSize: 13, color: c.textMuted, marginBottom: 10, fontWeight: '700', letterSpacing: 0.5 }}>
              FRACCIONES DE JORNADA REGISTRADAS
            </Text>

            {marcasDelDia.length === 0 ? (
              <View style={{ backgroundColor: alpha(c.surface, 0.19), padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: alpha(c.borderStrong, 0.08), marginBottom: 20 }}>
                <Text style={{ color: c.textFaint, fontSize: 13, fontStyle: 'italic', textAlign: 'center' }}>
                  No se encontraron marcas automáticas registradas en este día.
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: alpha(c.surface, 0.25), borderRadius: 16, padding: 12, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.08), marginBottom: 20, gap: 10 }}>
                {marcasDelDia.map((punch, idx) => {
                  const esEntrada = punch.tipo === 'ENTRADA';
                  const esManual = punch.tipo === 'MANUAL' || punch.tipo === 'MANUAL_JORNADA';
                  const horaConSegundos = punch.hora ? punch.hora.toLowerCase() : '';
                  return (
                    <View key={punch.id || idx} style={{ backgroundColor: alpha(c.surfaceAlt, 0.38), padding: 10, borderRadius: 12, borderWidth: 1, borderColor: punch.motivoSinGps ? alpha(c.warning, 0.35) : alpha(c.borderStrong, 0.06) }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ 
                          paddingHorizontal: 8, 
                          paddingVertical: 3, 
                          borderRadius: 6, 
                          backgroundColor: esManual ? alpha(c.primary, 0.08) : esEntrada ? alpha(c.cyan, 0.08) : alpha(c.danger, 0.08), 
                          borderWidth: 1, 
                          borderColor: esManual ? alpha(c.primary, 0.2) : esEntrada ? alpha(c.cyan, 0.2) : alpha(c.danger, 0.2) 
                        }}>
                          <Text style={{ color: esManual ? c.primary : esEntrada ? c.cyan : c.danger, fontSize: 9, fontWeight: '800' }}>
                            {punch.tipo}
                          </Text>
                        </View>
                        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                          {horaConSegundos}
                        </Text>
                      </View>
                      {!esManual && punch.latitude != null && (
                        <Text style={{ color: c.textFaint, fontSize: 11 }}>
                          Precisión: {punch.accuracy ? `${Math.round(punch.accuracy)}m` : 'OK'}
                        </Text>
                      )}
                      {punch.corteMedianoche && (
                        <Text style={{ color: c.textFaint, fontSize: 11 }}>Corte 00:00</Text>
                      )}
                      {!!punch.motivoSinGps && (
                        <Text style={{ color: c.warning, fontSize: 11, fontWeight: '700' }}>SIN GPS</Text>
                      )}
                    </View>
                    {!!punch.motivoSinGps && (
                      <Text style={{ color: c.warning, fontSize: 12, marginTop: 6 }}>Motivo: {punch.motivoSinGps}</Text>
                    )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Domingo o festivo (bloqueado en días con registro manual) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surface, padding: 14, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.13), opacity: esRegistroManual ? 0.5 : 1 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, color: c.text, fontWeight: '500', marginBottom: 2 }}>¿Es Domingo o Festivo?</Text>
                <Text style={{ fontSize: 11, color: c.textMuted }}>
                  {esRegistroManual ? 'Bloqueado: Administrado desde registro manual.' : `Aplica el recargo dominical/festivo (+${getRecargoDominical(dateStr)}% vigente para esta fecha).`}
                </Text>
              </View>
              <Switch 
                disabled={esRegistroManual}
                value={isHoliday} 
                onValueChange={setIsHoliday} 
                trackColor={{ false: c.bg, true: alpha(c.primary, 0.25) }} 
                thumbColor={isHoliday ? c.primary : c.textMuted} 
              />
            </View>

            {/* Notas (bloqueadas en días con registro manual) */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, color: c.textMuted, marginBottom: 8, fontWeight: '500' }}>Notas / Actividades</Text>
              <TextInput
                editable={!esRegistroManual}
                value={notes} 
                onChangeText={setNotes} 
                placeholder={esRegistroManual ? "Notas fijadas en registro manual." : "Escribe aquí las novedades del día..."} 
                placeholderTextColor={c.placeholder} 
                multiline={true} 
                numberOfLines={2} 
                style={{ backgroundColor: c.surface, color: esRegistroManual ? c.textFaint : c.text, padding: 14, borderRadius: 12, fontSize: 15, minHeight: 64, textAlignVertical: 'top', borderWidth: 1, borderColor: alpha(c.borderStrong, 0.25), opacity: esRegistroManual ? 0.6 : 1 }} 
              />
            </View>

            {saving && (
              <Text style={{ color: c.cyan, fontSize: 12, textAlign: 'center', marginBottom: 12, fontWeight: '500' }}>
                Guardando cambios...
              </Text>
            )}

            {/* Acciones */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              {hasExistingData && (
                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={saving}
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: alpha(c.danger, 0.19), alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: c.danger, fontSize: 15, fontWeight: '600' }}>Eliminar</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || esRegistroManual}
                style={{ 
                  flex: 1, 
                  backgroundColor: esRegistroManual ? c.surfaceAlt : saving ? c.surface : c.primary, 
                  paddingVertical: 14, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  opacity: esRegistroManual ? 0.4 : 1 
                }}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={c.onPrimary} />
                ) : (
                  <Text style={{ color: esRegistroManual ? c.textFaint : c.onPrimary, fontSize: 16, fontWeight: '600' }}>
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

