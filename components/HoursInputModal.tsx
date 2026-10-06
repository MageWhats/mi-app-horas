// components/HoursInputModal.tsx
// Detalle de un día: marcas (con anulación de registros manuales), recargo automático y notas.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { mostrarAlerta } from '../lib/alert';
import { mensajeDeError } from '../lib/errores';
import { alpha, useTheme } from '../lib/theme';
import { getRecargoDominical, nombreFestivo, startOfDay } from '../lib/utils';
import { Marca } from '../types/hours';
import { TabBarIcon } from './TabBarIcon';

interface HoursInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const etiquetaTipo: Record<Marca['tipo'], string> = {
  ENTRADA: 'ENTRADA',
  SALIDA: 'SALIDA',
  MANUAL: 'MANUAL',
  MANUAL_JORNADA: 'JORNADA',
};

export const HoursInputModal: React.FC<HoursInputModalProps> = ({ isOpen, onClose, dateStr }) => {
  const { colors: c } = useTheme();
  const { entries, updateNotes, anularMarca } = useWorkHours();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Anulación en línea: marca seleccionada y motivo (Alert.prompt no existe en Android)
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errorAnulacion, setErrorAnulacion] = useState('');

  const dayData = dateStr ? entries[dateStr] ?? null : null;
  const marcas: Marca[] = dayData?.marcas ?? [];

  // Carga las notas solo al abrir: una actualización en vivo no borra lo que se está escribiendo
  useEffect(() => {
    if (isOpen && dateStr) {
      setNotes(entries[dateStr]?.notes ?? '');
      setAnulando(null);
      setMotivo('');
      setErrorAnulacion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dateStr]);

  if (!dateStr) return null;

  const fecha = startOfDay(dateStr);
  const festivo = nombreFestivo(dateStr);
  const esDomingo = fecha.getDay() === 0;
  const titulo = `${DIAS[fecha.getDay()]} ${dateStr.slice(8)}/${dateStr.slice(5, 7)}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotes(dateStr, notes.trim() || null);
      mostrarAlerta('Notas guardadas');
      onClose();
    } catch (error) {
      console.error('Error al guardar las notas:', error);
      mostrarAlerta('No se pudieron guardar las notas', mensajeDeError(error, 'Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmarAnulacion = async () => {
    if (!anulando) return;
    if (motivo.trim().length < 5) {
      setErrorAnulacion('Escribe el motivo (mínimo 5 caracteres).');
      return;
    }
    setSaving(true);
    try {
      await anularMarca(anulando, motivo);
      setAnulando(null);
      setMotivo('');
      setErrorAnulacion('');
    } catch (error) {
      console.error('Error al anular la marca:', error);
      setErrorAnulacion(mensajeDeError(error, 'No se pudo anular. Revisa tu conexión.'));
    } finally {
      setSaving(false);
    }
  };

  const colorTipo = (m: Marca) =>
    m.tipo === 'ENTRADA' ? c.success : m.tipo === 'SALIDA' ? c.danger : c.primary;

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={{
          backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22,
          paddingBottom: 32, maxHeight: '88%', borderWidth: 1, borderColor: c.border, width: '100%', maxWidth: 640, alignSelf: 'center',
        }}>
          <View style={{ width: 45, height: 4, backgroundColor: c.borderStrong, borderRadius: 2, alignSelf: 'center', marginVertical: 14 }} />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Encabezado */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <View>
                <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: '700', letterSpacing: 0.8 }}>DETALLE DEL DÍA</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>{titulo}</Text>
              </View>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar" style={{ padding: 8, borderRadius: 20, backgroundColor: c.surface }}>
                <TabBarIcon name="close" size={20} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Recargo automático */}
            {(festivo || esDomingo) && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, marginBottom: 16,
                backgroundColor: alpha(c.warning, 0.1), borderWidth: 1, borderColor: alpha(c.warning, 0.3),
              }}>
                <TabBarIcon name="calendar" size={18} color={c.warning} />
                <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{festivo ? `Festivo: ${festivo}` : 'Domingo'}</Text>
                  {` · aplica recargo del ${getRecargoDominical(dateStr)}%`}
                </Text>
              </View>
            )}

            {/* Marcas */}
            <Text style={{ fontSize: 12, color: c.textMuted, marginBottom: 10, fontWeight: '800', letterSpacing: 0.8 }}>MARCAS DEL DÍA</Text>

            {marcas.length === 0 ? (
              <View style={{ backgroundColor: c.surface, padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border, marginBottom: 20 }}>
                <Text style={{ color: c.textFaint, fontSize: 13, fontStyle: 'italic', textAlign: 'center' }}>
                  No hay marcas registradas en este día.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginBottom: 20 }}>
                {marcas.map((m, idx) => {
                  const manual = m.tipo === 'MANUAL' || m.tipo === 'MANUAL_JORNADA';
                  const color = colorTipo(m);
                  const abierta = anulando === m.id;
                  return (
                    <View
                      key={m.id || idx}
                      style={{
                        backgroundColor: c.surface, padding: 12, borderRadius: 12, borderWidth: 1,
                        borderColor: m.motivoSinGps || m.ubicacionSimulada ? alpha(c.warning, 0.4) : c.border,
                        opacity: m.anulada ? 0.6 : 1,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: alpha(color, 0.12) }}>
                          <Text style={{ color, fontSize: 10, fontWeight: '800' }}>{etiquetaTipo[m.tipo]}</Text>
                        </View>
                        <Text style={{
                          color: c.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], flex: 1,
                          textDecorationLine: m.anulada ? 'line-through' : 'none',
                        }}>
                          {m.hora.toLowerCase()}
                        </Text>

                        {m.anulada && <Text style={{ color: c.danger, fontSize: 11, fontWeight: '800' }}>ANULADA</Text>}
                        {!m.anulada && m.corteMedianoche && <Text style={{ color: c.textFaint, fontSize: 11 }}>Corte 00:00</Text>}
                        {!m.anulada && m.latitude != null && !m.ubicacionSimulada && (
                          <Text style={{ color: c.textFaint, fontSize: 11 }}>
                            GPS {m.accuracy ? `±${Math.round(m.accuracy)} m` : 'OK'}
                          </Text>
                        )}
                        {!!m.motivoSinGps && <Text style={{ color: c.warning, fontSize: 11, fontWeight: '800' }}>SIN GPS</Text>}
                        {m.ubicacionSimulada && <Text style={{ color: c.warning, fontSize: 11, fontWeight: '800' }}>GPS SIMULADO</Text>}

                        {manual && !m.anulada && !abierta && (
                          <TouchableOpacity
                            onPress={() => { setAnulando(m.id); setMotivo(''); setErrorAnulacion(''); }}
                            disabled={saving}
                            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: alpha(c.danger, 0.4) }}
                          >
                            <Text style={{ color: c.danger, fontSize: 12, fontWeight: '700' }}>Anular</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {!!m.motivoSinGps && (
                        <Text style={{ color: c.warning, fontSize: 12, marginTop: 6 }}>Motivo sin GPS: {m.motivoSinGps}</Text>
                      )}
                      {m.anulada && !!m.motivoAnulacion && (
                        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 6 }}>Motivo de anulación: {m.motivoAnulacion}</Text>
                      )}

                      {/* Formulario de anulación */}
                      {abierta && (
                        <View style={{ marginTop: 10, gap: 8 }}>
                          <Text style={{ color: c.textMuted, fontSize: 12 }}>
                            La marca no se borra: queda tachada y deja de sumar horas. ¿Por qué la anulas?
                          </Text>
                          <TextInput
                            value={motivo}
                            onChangeText={(t) => { setMotivo(t); setErrorAnulacion(''); }}
                            placeholder="Ej: registré el día equivocado"
                            placeholderTextColor={c.placeholder}
                            maxLength={200}
                            autoFocus
                            style={{
                              backgroundColor: c.input, color: c.text, padding: 10, borderRadius: 10, fontSize: 14,
                              borderWidth: 1, borderColor: errorAnulacion ? c.danger : c.borderStrong,
                            }}
                          />
                          {!!errorAnulacion && <Text style={{ color: c.danger, fontSize: 12 }}>{errorAnulacion}</Text>}
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => setAnulando(null)}
                              disabled={saving}
                              style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: 'center' }}
                            >
                              <Text style={{ color: c.textMuted, fontWeight: '600' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={confirmarAnulacion}
                              disabled={saving}
                              style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: c.danger, alignItems: 'center' }}
                            >
                              {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={{ color: c.onPrimary, fontWeight: '700' }}>Anular marca</Text>}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Notas */}
            <Text style={{ fontSize: 12, color: c.textMuted, marginBottom: 8, fontWeight: '800', letterSpacing: 0.8 }}>NOTAS DEL DÍA</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Escribe aquí las novedades del día…"
              placeholderTextColor={c.placeholder}
              multiline
              maxLength={500}
              style={{
                backgroundColor: c.input, color: c.text, padding: 14, borderRadius: 12, fontSize: 15, minHeight: 72,
                textAlignVertical: 'top', borderWidth: 1, borderColor: c.borderStrong, marginBottom: 16,
              }}
            />

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              style={{ backgroundColor: c.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: saving ? 0.7 : 1, marginBottom: 8 }}
            >
              {saving && !anulando ? <ActivityIndicator color={c.onPrimary} /> : <Text style={{ color: c.onPrimary, fontSize: 16, fontWeight: '700' }}>Guardar notas</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
