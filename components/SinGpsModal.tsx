// components/SinGpsModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { alConcederPermisoWeb, entornoWeb, FalloGps } from '../lib/location';
import { TabBarIcon } from './TabBarIcon';
import { alpha, useTheme } from '../lib/theme';

const MOTIVOS = [
  'Sin señal / zona sin cobertura',
  'GPS del celular apagado',
  'No di permiso de ubicación',
  'El celular no tiene GPS o está dañado',
  'Otro',
];

const EXPLICACION: Record<FalloGps, { titulo: string; detalle: string; motivo: string }> = {
  PERMISO: {
    titulo: 'Sin permiso de ubicación',
    detalle: 'La app no tiene permiso para ver tu ubicación. Reintenta y acepta el permiso cuando el celular lo pida.',
    motivo: 'No di permiso de ubicación',
  },
  PERMISO_BLOQUEADO: {
    titulo: 'Permiso de ubicación bloqueado',
    detalle: 'El permiso de ubicación está denegado. Actívalo en los ajustes de la app y vuelve a intentarlo.',
    motivo: 'No di permiso de ubicación',
  },
  SERVICIOS: {
    titulo: 'El GPS está apagado',
    detalle: 'Activa la ubicación del celular y vuelve a intentarlo.',
    motivo: 'GPS del celular apagado',
  },
  TIEMPO: {
    titulo: 'No se encontró señal GPS',
    detalle: 'El celular no logró ubicarse a tiempo. Si estás bajo techo, acércate a una zona abierta y reintenta.',
    motivo: 'Sin señal / zona sin cobertura',
  },
  NO_DISPONIBLE: {
    titulo: 'Ubicación no disponible',
    detalle: 'Este dispositivo o navegador no pudo entregar la ubicación.',
    motivo: 'El celular no tiene GPS o está dañado',
  },
};

// En el navegador no se puede abrir los ajustes ni forzar la ventana de permiso: se explica cómo hacerlo
const DETALLE_WEB: Partial<Record<FalloGps, string>> = {
  PERMISO: 'Rechazaste el permiso de ubicación. Toca "Reintentar GPS" y elige "Permitir".',
  PERMISO_BLOQUEADO: 'El navegador tiene bloqueada la ubicación para esta página y no volverá a preguntar por sí solo. Sigue estos pasos:',
  SERVICIOS: 'La ubicación del celular parece estar apagada o sin señal. Sigue estos pasos:',
};

/** Pasos para activar la ubicación según el celular y el navegador. Solo aplica a la versión web. */
export const pasosWeb = (fallo: FalloGps): string[] => {
  if (fallo !== 'PERMISO_BLOQUEADO' && fallo !== 'SERVICIOS') return [];
  const { sistema, navegador, instalada } = entornoWeb();
  const bloqueado = fallo === 'PERMISO_BLOQUEADO';

  if (sistema === 'ios') {
    const appEnAjustes = instalada || navegador === 'Safari' ? 'Sitios web de Safari' : navegador;
    const pasos = [
      'Abre Ajustes › Privacidad y seguridad › Localización y verifica que esté activada.',
      `En esa misma lista entra a "${appEnAjustes}" y elige "Mientras se usa la app" o "Preguntar la próxima vez".`,
    ];
    if (bloqueado) {
      if (instalada) pasos.push('En Ajustes › Apps › Safari › Ubicación, elige "Preguntar" o "Permitir".');
      else if (navegador === 'Safari') pasos.push('De vuelta en Safari, toca "aA" en la barra de dirección › Configuración del sitio web › Ubicación › Permitir.');
      else pasos.push(`En ${navegador}, revisa la configuración del sitio y permite la ubicación.`);
    }
    pasos.push('Regresa aquí y toca "Recargar página".');
    return pasos;
  }

  if (sistema === 'android') {
    const pasos: string[] = [];
    if (!bloqueado) pasos.push('Desliza desde arriba de la pantalla y activa "Ubicación".');
    if (bloqueado && instalada) {
      pasos.push('Mantén presionado el ícono de la app › Información de la app › Permisos › Ubicación › Permitir.');
    } else if (bloqueado) {
      pasos.push('Toca el ícono a la izquierda de la dirección de la página › Permisos › Ubicación › Permitir.');
    }
    pasos.push(`Revisa también Ajustes del celular › Aplicaciones › ${navegador === 'el navegador' ? 'tu navegador' : navegador} › Permisos › Ubicación › "Permitir solo con la app en uso".`);
    pasos.push('Regresa aquí y toca "Reintentar GPS" (o "Recargar página" si no funciona).');
    return pasos;
  }

  return bloqueado
    ? ['Haz clic en el candado o ícono a la izquierda de la dirección › Ubicación › Permitir.', 'Recarga la página y vuelve a intentarlo.']
    : ['Activa los servicios de ubicación del equipo y vuelve a intentarlo.'];
};

interface SinGpsModalProps {
  fallo: FalloGps | null;
  tipoMarca: 'ENTRADA' | 'SALIDA';
  reintentando: boolean;
  guardando: boolean;
  onReintentar: () => void;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}

/**
 * Se abre cuando no hay GPS. La marca solo se guarda si el operario justifica por qué.
 */
export const SinGpsModal: React.FC<SinGpsModalProps> = ({
  fallo, tipoMarca, reintentando, guardando, onReintentar, onConfirmar, onCancelar,
}) => {
  const { colors: c } = useTheme();
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');

  // Preselecciona el motivo que corresponde al fallo detectado
  useEffect(() => {
    if (fallo) {
      setMotivo(EXPLICACION[fallo].motivo);
      setDetalle('');
      setError('');
    }
  }, [fallo]);

  // Al volver de los ajustes del celular o del navegador se reintenta solo, sin que el operario lo pida
  const reintentoAutomatico = useRef(onReintentar);
  reintentoAutomatico.current = () => { if (!reintentando && !guardando) onReintentar(); };
  const requiereAjustes = fallo === 'PERMISO_BLOQUEADO' || fallo === 'SERVICIOS';
  useEffect(() => {
    if (!requiereAjustes) return;
    const reintentar = () => reintentoAutomatico.current();

    if (Platform.OS === 'web') {
      const alVolver = () => { if (document.visibilityState === 'visible') reintentar(); };
      document.addEventListener('visibilitychange', alVolver);
      const dejarDeEscuchar = alConcederPermisoWeb(reintentar);
      return () => {
        document.removeEventListener('visibilitychange', alVolver);
        dejarDeEscuchar();
      };
    }

    let enSegundoPlano = false;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && enSegundoPlano) reintentar();
      enSegundoPlano = estado !== 'active';
    });
    return () => sub.remove();
  }, [requiereAjustes]);

  if (!fallo) return null;
  const esWeb = Platform.OS === 'web';
  const info = EXPLICACION[fallo];
  const detalleFallo = (esWeb && DETALLE_WEB[fallo]) || info.detalle;
  const pasos = esWeb ? pasosWeb(fallo) : [];
  const puedeAbrirAjustes = !esWeb && requiereAjustes;
  const puedeRecargar = esWeb && fallo === 'PERMISO_BLOQUEADO';
  const ocupado = reintentando || guardando;

  const confirmar = () => {
    if (!motivo) {
      setError('Selecciona el motivo.');
      return;
    }
    if (motivo === 'Otro' && detalle.trim().length < 10) {
      setError('Explica el motivo (mínimo 10 caracteres).');
      return;
    }
    const texto = motivo === 'Otro' ? detalle.trim() : detalle.trim() ? `${motivo}. ${detalle.trim()}` : motivo;
    onConfirmar(texto);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancelar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, maxHeight: '92%' }}
          contentContainerStyle={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, borderWidth: 1, borderColor: c.surface, width: '100%', maxWidth: 600, alignSelf: 'center' }}
        >
          {/* Problema detectado */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <TabBarIcon name="alert-circle" size={26} color={c.warning} />
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', flex: 1 }}>{info.titulo}</Text>
          </View>
          <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20, marginBottom: pasos.length ? 10 : 16 }}>{detalleFallo}</Text>
          {pasos.length > 0 && (
            <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 8, marginBottom: 16 }}>
              {pasos.map((paso, i) => (
                <View key={paso} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: c.primary, fontSize: 13, fontWeight: '800', width: 16 }}>{i + 1}.</Text>
                  <Text style={{ color: c.text, fontSize: 13, lineHeight: 19, flex: 1 }}>{paso}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Primero intentar solucionarlo */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={onReintentar}
              disabled={ocupado}
              style={{ flex: 1, backgroundColor: c.primary, padding: 13, borderRadius: 12, alignItems: 'center', opacity: ocupado ? 0.6 : 1 }}
            >
              {reintentando ? <ActivityIndicator color={c.onPrimary} /> : <Text style={{ color: c.onPrimary, fontWeight: '700' }}>Reintentar GPS</Text>}
            </TouchableOpacity>
            {puedeAbrirAjustes && (
              <TouchableOpacity
                onPress={() => Linking.openSettings()}
                disabled={ocupado}
                style={{ flex: 1, backgroundColor: c.surface, padding: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: alpha(c.borderStrong, 0.25) }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Abrir ajustes</Text>
              </TouchableOpacity>
            )}
            {puedeRecargar && (
              <TouchableOpacity
                onPress={() => window.location.reload()}
                disabled={ocupado}
                style={{ flex: 1, backgroundColor: c.surface, padding: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: alpha(c.borderStrong, 0.25) }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Recargar página</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Justificación obligatoria */}
          <View style={{ borderTopWidth: 1, borderTopColor: c.surface, paddingTop: 16 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
              ¿Registrar la {tipoMarca.toLowerCase()} sin GPS?
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 12 }}>
              Indica el motivo. Quedará guardado junto a la marca y aparecerá en el reporte de Excel.
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {MOTIVOS.map((m) => {
                const activo = motivo === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => { setMotivo(m); setError(''); }}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
                      borderColor: activo ? c.warning : alpha(c.borderStrong, 0.38),
                      backgroundColor: activo ? alpha(c.warning, 0.15) : 'transparent',
                    }}
                  >
                    <Text style={{ color: activo ? c.warning : c.textMuted, fontSize: 13, fontWeight: activo ? '700' : '500' }}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={detalle}
              onChangeText={(t) => { setDetalle(t); setError(''); }}
              placeholder={motivo === 'Otro' ? 'Explica por qué no hay GPS (obligatorio)' : 'Detalle adicional (opcional)'}
              placeholderTextColor={c.textFaint}
              multiline
              maxLength={200}
              style={{ backgroundColor: c.surface, color: c.text, padding: 12, borderRadius: 12, minHeight: 64, textAlignVertical: 'top', fontSize: 14, borderWidth: 1, borderColor: error ? c.danger : alpha(c.borderStrong, 0.25) }}
            />
            {!!error && <Text style={{ color: c.danger, fontSize: 12, marginTop: 6 }}>{error}</Text>}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 8 }}>
            <TouchableOpacity onPress={onCancelar} disabled={guardando} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center' }}>
              <Text style={{ color: c.textMuted, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmar}
              disabled={ocupado}
              style={{ flex: 1.4, padding: 14, borderRadius: 12, backgroundColor: c.warning, alignItems: 'center', opacity: ocupado ? 0.6 : 1 }}
            >
              {guardando ? <ActivityIndicator color={c.onPrimary} /> : <Text style={{ color: c.onPrimary, fontWeight: '800' }}>Registrar sin GPS</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
