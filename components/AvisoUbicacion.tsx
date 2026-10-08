// components/AvisoUbicacion.tsx
// Aviso de Inicio que pide activar la ubicación antes de marcar, para no descubrir el problema al ponchar.
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';
import { obtenerUbicacion, useEstadoUbicacion } from '../lib/location';
import { alpha, useTheme } from '../lib/theme';
import { pasosWeb } from './SinGpsModal';
import { TabBarIcon } from './TabBarIcon';

export const AvisoUbicacion: React.FC = () => {
  const { colors: c } = useTheme();
  const { estado, refrescar } = useEstadoUbicacion();
  const [pidiendo, setPidiendo] = useState(false);
  // El navegador puede rechazar sin preguntar aunque informe "preguntar" (Safari tras un rechazo)
  const [rechazoSilencioso, setRechazoSilencioso] = useState(false);
  const [verPasos, setVerPasos] = useState(false);

  const esWeb = Platform.OS === 'web';
  const bloqueado = estado === 'BLOQUEADO' || (rechazoSilencioso && estado !== 'CONCEDIDO');
  if (!estado || estado === 'CONCEDIDO' || estado === 'DESCONOCIDO') return null;

  /** La ventana de permiso solo aparece si se pide en respuesta a un toque del usuario. */
  const pedirPermiso = async () => {
    setPidiendo(true);
    const resultado = await obtenerUbicacion();
    setPidiendo(false);
    if (!resultado.ok && resultado.fallo === 'PERMISO_BLOQUEADO') {
      setRechazoSilencioso(true);
      if (esWeb) setVerPasos(true);
    }
    refrescar();
  };

  const color = bloqueado ? c.danger : c.warning;
  const apagado = estado === 'APAGADO';
  const titulo = bloqueado ? 'Ubicación bloqueada.' : apagado ? 'La ubicación del celular está apagada.' : 'Activa tu ubicación.';
  const detalle = bloqueado
    ? ' Sin ella tus marcas quedan sin GPS y deberás justificarlas.'
    : ' La necesitas para registrar tu entrada y salida.';

  let accion: { texto: string; onPress: () => void } | null = null;
  if (bloqueado) {
    accion = esWeb
      ? { texto: verPasos ? 'Ocultar' : 'Cómo activarla', onPress: () => setVerPasos((v) => !v) }
      : { texto: 'Abrir ajustes', onPress: () => Linking.openSettings() };
  } else if (apagado && Platform.OS === 'ios') {
    accion = { texto: 'Abrir ajustes', onPress: () => Linking.openSettings() };
  } else {
    accion = { texto: 'Activar', onPress: pedirPermiso };
  }

  const pasos = esWeb && verPasos ? pasosWeb(bloqueado ? 'PERMISO_BLOQUEADO' : 'SERVICIOS') : [];

  return (
    <View
      style={{
        padding: 12, borderRadius: 14, marginBottom: 8,
        backgroundColor: alpha(color, 0.1), borderWidth: 1, borderColor: alpha(color, 0.35),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TabBarIcon name="location-outline" size={18} color={color} />
        <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>{titulo}</Text>
          {detalle}
        </Text>
        <TouchableOpacity
          onPress={accion.onPress}
          disabled={pidiendo}
          accessibilityRole="button"
          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: color, minWidth: 70, alignItems: 'center' }}
        >
          {pidiendo
            ? <ActivityIndicator size="small" color={c.onPrimary} />
            : <Text style={{ color: c.onPrimary, fontSize: 12, fontWeight: '800' }}>{accion.texto}</Text>}
        </TouchableOpacity>
      </View>

      {pasos.length > 0 && (
        <View style={{ marginTop: 10, gap: 6 }}>
          {pasos.map((paso, i) => (
            <View key={paso} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color, fontSize: 12, fontWeight: '800', width: 16 }}>{i + 1}.</Text>
              <Text style={{ color: c.text, fontSize: 12, lineHeight: 18, flex: 1 }}>{paso}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={() => window.location.reload()} style={{ alignSelf: 'flex-start', marginTop: 4, paddingVertical: 6 }}>
            <Text style={{ color, fontSize: 12, fontWeight: '800' }}>Recargar página</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
