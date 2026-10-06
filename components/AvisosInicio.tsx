// components/AvisosInicio.tsx
// Avisos de Inicio: marcas sin conexión, turno abierto demasiado tiempo y cercanía al límite semanal.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
import { HORAS_RECORDATORIO } from '../lib/recordatorios';
import { alpha, useTheme } from '../lib/theme';
import { TabBarIcon } from './TabBarIcon';

/** Horas antes del límite semanal a partir de las que se avisa */
const MARGEN_SEMANAL = 4;

const formatoDuracion = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const AvisosInicio: React.FC = () => {
  const { colors: c } = useTheme();
  const { colaMarcas, descartarMarcaRechazada, openShift, globalSeconds, semanaActual } = useWorkHours();

  const pendientes = colaMarcas.filter((m) => m.estado === 'pendiente');
  const rechazadas = colaMarcas.filter((m) => m.estado === 'rechazada');
  const turnoLargo = !!openShift && globalSeconds >= HORAS_RECORDATORIO * 3600;
  const { horas, limite } = semanaActual;
  const cercaDelLimite = horas >= limite - MARGEN_SEMANAL;

  if (!pendientes.length && !rechazadas.length && !turnoLargo && !cercaDelLimite) return null;

  const aviso = (color: string, icono: string, contenido: React.ReactNode, clave: string, accion?: React.ReactNode) => (
    <View
      key={clave}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, marginBottom: 8,
        backgroundColor: alpha(color, 0.1), borderWidth: 1, borderColor: alpha(color, 0.35),
      }}
    >
      <TabBarIcon name={icono} size={18} color={color} />
      <View style={{ flex: 1 }}>{contenido}</View>
      {accion}
    </View>
  );

  return (
    <View style={{ marginBottom: 4 }}>
      {pendientes.length > 0 && aviso(c.info, 'time-outline', (
        <Text style={{ color: c.text, fontSize: 13 }}>
          <Text style={{ fontWeight: '700' }}>
            {pendientes.length === 1 ? '1 marca guardada sin conexión' : `${pendientes.length} marcas guardadas sin conexión`}
          </Text>
          {'. Se enviarán solas al volver la señal.'}
        </Text>
      ), 'pendientes')}

      {rechazadas.map((m) => aviso(c.danger, 'alert-circle', (
        <Text style={{ color: c.text, fontSize: 13 }}>
          <Text style={{ fontWeight: '700' }}>
            {`${m.tipo} sin conexión del ${new Date(m.momento).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} no se registró. `}
          </Text>
          {m.error}
        </Text>
      ), m.idCliente, (
        <TouchableOpacity onPress={() => descartarMarcaRechazada(m.idCliente)} style={{ padding: 6 }} accessibilityLabel="Descartar aviso">
          <TabBarIcon name="close" size={18} color={c.textMuted} />
        </TouchableOpacity>
      )))}

      {turnoLargo && aviso(c.warning, 'alert-circle', (
        <Text style={{ color: c.text, fontSize: 13 }}>
          <Text style={{ fontWeight: '700' }}>{`Llevas ${formatoDuracion(globalSeconds)} con el turno abierto.`}</Text>
          {' ¿Olvidaste marcar la salida?'}
        </Text>
      ), 'turno')}

      {cercaDelLimite && aviso(horas > limite ? c.danger : c.warning, 'trending-up-outline', (
        <Text style={{ color: c.text, fontSize: 13 }}>
          {horas > limite ? 'Superaste el límite semanal: ' : 'Te acercas al límite semanal: '}
          <Text style={{ fontWeight: '700' }}>{`${horas} h de ${limite} h`}</Text>
          {' esta semana.'}
        </Text>
      ), 'semana')}
    </View>
  );
};
