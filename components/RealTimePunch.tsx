// components/RealTimePunch.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useWorkHours } from '../context/WorkHoursContext';
import { mostrarAlerta } from '../lib/alert';
import { mensajeDeError } from '../lib/errores';
import { FalloGps, GeoCoords, obtenerUbicacion } from '../lib/location';
import { alpha, Paleta, useTheme, useThemedStyles } from '../lib/theme';
import { toLocalDateStr } from '../lib/utils';
import { SinGpsModal } from './SinGpsModal';
import { TabBarIcon } from './TabBarIcon';

export const formatSeconds = (totalSecs: number) => {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const RealTimePunch: React.FC = () => {
  const { openShift, proximaMarca, globalSeconds, punchInRealTime } = useWorkHours();
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [falloGps, setFalloGps] = useState<FalloGps | null>(null);

  // El estado se deriva del turno abierto guardado en la nube (puede venir de ayer)
  const currentStatus = openShift ? 'LABORANDO' : 'FUERA';
  const turnoDesdeAyer = !!openShift && openShift.date !== toLocalDateStr();
  const timeString = formatSeconds(globalSeconds);
  const ocupado = buscandoGps || guardando;
  const laborando = currentStatus === 'LABORANDO';

  const { colors: c } = useTheme();
  const styles = useThemedStyles(crearEstilos);

  // Anillo que late alrededor del botón mientras el turno está abierto
  const pulso = useSharedValue(0);
  useEffect(() => {
    if (laborando) {
      pulso.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(pulso);
      pulso.value = 0;
    }
  }, [laborando, pulso]);
  const estiloPulso = useAnimatedStyle(() => ({
    opacity: laborando ? 0.55 * (1 - pulso.value) : 0,
    transform: [{ scale: 1 + pulso.value * 0.28 }],
  }));

  const hoy = new Date();
  const fechaHoy = `${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][hoy.getDay()]} ${hoy.getDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][hoy.getMonth()]}`;
  const colorBoton = laborando ? c.danger : c.primary;

  const registrar = async (coords: GeoCoords | null, motivoSinGps?: string) => {
    setGuardando(true);
    try {
      const marca = await punchInRealTime(coords, motivoSinGps);
      setFalloGps(null);
      const detalle = !coords
        ? 'Se guardó sin GPS con el motivo indicado.'
        : coords.simulada
          ? 'Tu celular reportó una ubicación simulada: la marca quedó señalada para revisión.'
          : undefined;
      mostrarAlerta(`Marca de ${marca} registrada`, detalle);
    } catch (e) {
      console.error('Error en el ponchador de tiempo real:', e);
      mostrarAlerta('No se pudo registrar la marca', mensajeDeError(e, 'Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  /** Busca la ubicación; si no hay, abre la ventana de justificación en lugar de guardar. */
  const intentarConGps = async () => {
    setBuscandoGps(true);
    const resultado = await obtenerUbicacion();
    setBuscandoGps(false);

    if (resultado.ok) {
      await registrar(resultado.coords);
    } else {
      setFalloGps(resultado.fallo);
    }
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.tarjeta}>
        {/* Estado y fecha */}
        <View style={styles.filaSuperior}>
          <View style={[styles.pildora, { backgroundColor: alpha(laborando ? c.success : c.textFaint, 0.14) }]}>
            <View style={[styles.punto, { backgroundColor: laborando ? c.success : c.textFaint }]} />
            <Text style={[styles.pildoraTexto, { color: laborando ? c.success : c.textMuted }]}>
              {laborando ? 'En turno' : 'Fuera de turno'}
            </Text>
          </View>
          <Text style={styles.fecha}>{fechaHoy}</Text>
        </View>

        {/* Cronómetro */}
        <Text style={styles.cronometroEtiqueta}>
          {turnoDesdeAyer ? 'TURNO NOCTURNO · INICIÓ AYER' : 'TIEMPO DEL TURNO ACTUAL'}
        </Text>
        <Text style={[styles.cronometro, { color: laborando ? c.text : c.textFaint }]}>{timeString}</Text>

        {/* Botón principal */}
        <View style={styles.zonaBoton}>
          <Animated.View style={[styles.anillo, { borderColor: colorBoton }, estiloPulso]} pointerEvents="none" />
          <TouchableOpacity
            onPress={intentarConGps}
            disabled={ocupado}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={laborando ? 'Finalizar turno' : 'Iniciar jornada'}
            style={[styles.boton, { backgroundColor: colorBoton, shadowColor: colorBoton, borderColor: alpha(colorBoton, 0.35) }]}
          >
            {ocupado && !falloGps ? (
              <ActivityIndicator size="large" color={c.onPrimary} />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <TabBarIcon name={laborando ? 'stop-circle' : 'play-circle'} size={46} color={c.onPrimary} />
                <Text style={styles.botonTexto}>{laborando ? 'FINALIZAR\nTURNO' : 'INICIAR\nJORNADA'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.ayuda}>
          {buscandoGps && !falloGps
            ? 'Obteniendo tu ubicación…'
            : laborando ? 'Toca para registrar tu salida' : 'Toca al llegar a tu frente de trabajo'}
        </Text>
      </View>

      <SinGpsModal
        fallo={falloGps}
        tipoMarca={proximaMarca}
        reintentando={buscandoGps}
        guardando={guardando}
        onReintentar={intentarConGps}
        onConfirmar={(motivo) => registrar(null, motivo)}
        onCancelar={() => setFalloGps(null)}
      />
    </View>
  );
};

const crearEstilos = (c: Paleta) => StyleSheet.create({
  container: { flex: 1, paddingTop: 4, paddingBottom: 12 },
  tarjeta: {
    flex: 1, backgroundColor: c.surface, borderRadius: 24, borderWidth: 1, borderColor: c.border,
    padding: 18, alignItems: 'center', justifyContent: 'space-between',
  },
  filaSuperior: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  pildora: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  pildoraTexto: { fontSize: 13, fontWeight: '700' },
  fecha: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
  cronometroEtiqueta: { color: c.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 14 },
  cronometro: { fontSize: 46, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  zonaBoton: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  anillo: { position: 'absolute', width: 168, height: 168, borderRadius: 84, borderWidth: 3 },
  boton: {
    width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center', borderWidth: 6,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
  },
  botonTexto: { color: c.onPrimary, fontSize: 14, fontWeight: '800', textAlign: 'center', letterSpacing: 0.6, marginTop: 6, lineHeight: 17 },
  ayuda: { color: c.textMuted, fontSize: 13, textAlign: 'center' },
});
