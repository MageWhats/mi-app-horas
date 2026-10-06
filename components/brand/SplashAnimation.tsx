// components/brand/SplashAnimation.tsx
// Animación de entrada: una esfera de reloj que se completa, el símbolo de Net&Sec y un saludo.
// Solo se animan transform y opacity (Reanimated, en el hilo de UI) para que corra fluida en Android, iOS y web.
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { alpha, PALETA_OSCURA as C } from '../../lib/theme';
import { Simbolo } from './Logo';

const MARCAS = 60;
const RADIO = 118;
const DIAMETRO = RADIO * 2;
const SIMBOLO = 104;

// Línea de tiempo (ms)
const T_BARRIDO = 1100;
const T_SIMBOLO = 950;
const T_TEXTO = 1300;
const T_SALIDA = 2900;
const DURACION_SALIDA = 450;

const REBOTE = Easing.bezier(0.34, 1.45, 0.64, 1);
const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

const saludoPorHora = () => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

/** Una marca de la esfera: se enciende cuando la manecilla pasa por ella. */
const Marca: React.FC<{ indice: number; barrido: SharedValue<number> }> = ({ indice, barrido }) => {
  const esHora = indice % 5 === 0;
  const umbral = indice / MARCAS;
  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(barrido.value, [umbral, umbral + 0.03], [0.12, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${indice * 6}deg` }] }]} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: RADIO - (esHora ? 1.5 : 1),
            width: esHora ? 3 : 2,
            height: esHora ? 14 : 7,
            borderRadius: 2,
            backgroundColor: esHora ? C.cyan : C.textMuted,
          },
          estilo,
        ]}
      />
    </View>
  );
};

interface SplashAnimationProps {
  nombre?: string;
  onTerminar: () => void;
}

export const SplashAnimation: React.FC<SplashAnimationProps> = ({ nombre, onTerminar }) => {
  const reducido = useReducedMotion();
  const terminado = useRef(false);

  const fondo = useSharedValue(0);
  const barrido = useSharedValue(0);
  const manecilla = useSharedValue(0);
  const simbolo = useSharedValue(0);
  const tic = useSharedValue(1);
  const titulo = useSharedValue(0);
  const subtitulo = useSharedValue(0);
  const saludo = useSharedValue(0);
  const salida = useSharedValue(0);

  const terminar = (inmediato = false) => {
    if (terminado.current) return;
    terminado.current = true;
    salida.value = withTiming(1, { duration: inmediato ? 250 : DURACION_SALIDA, easing: Easing.in(Easing.quad) });
    setTimeout(onTerminar, inmediato ? 250 : DURACION_SALIDA);
  };

  useEffect(() => {
    if (reducido) {
      // Sin movimiento: todo aparece con un fundido corto
      fondo.value = withTiming(1, { duration: 200 });
      barrido.value = 1;
      simbolo.value = withTiming(1, { duration: 300 });
      titulo.value = withTiming(1, { duration: 300 });
      subtitulo.value = withTiming(1, { duration: 300 });
      saludo.value = withTiming(1, { duration: 300 });
      const t = setTimeout(() => terminar(), 1200);
      return () => clearTimeout(t);
    }

    fondo.value = withTiming(1, { duration: 700, easing: SUAVE });
    barrido.value = withDelay(100, withTiming(1, { duration: T_BARRIDO, easing: Easing.inOut(Easing.cubic) }));
    manecilla.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(T_BARRIDO, withTiming(0, { duration: 300 })),
    );
    simbolo.value = withDelay(T_SIMBOLO, withTiming(1, { duration: 650, easing: REBOTE }));
    // "Tic": la esfera late una vez al completarse la vuelta
    tic.value = withDelay(T_BARRIDO + 100, withSequence(
      withTiming(1.05, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 260, easing: SUAVE }),
    ));
    titulo.value = withDelay(T_TEXTO, withTiming(1, { duration: 500, easing: SUAVE }));
    subtitulo.value = withDelay(T_TEXTO + 150, withTiming(1, { duration: 500, easing: SUAVE }));
    saludo.value = withDelay(T_TEXTO + 380, withTiming(1, { duration: 500, easing: SUAVE }));

    const t = setTimeout(() => terminar(), T_SALIDA);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducido]);

  const estiloContenedor = useAnimatedStyle(() => ({
    opacity: 1 - salida.value,
  }));
  const estiloContenido = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + salida.value * 0.12 }],
  }));
  const estiloResplandor = useAnimatedStyle(() => ({
    opacity: fondo.value,
    transform: [{ scale: 0.6 + fondo.value * 0.4 }],
  }));
  const estiloEsfera = useAnimatedStyle(() => ({
    transform: [{ scale: tic.value }],
  }));
  const estiloManecilla = useAnimatedStyle(() => ({
    opacity: manecilla.value,
    transform: [{ rotate: `${barrido.value * 360}deg` }],
  }));
  const estiloSimbolo = useAnimatedStyle(() => ({
    opacity: interpolate(simbolo.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: 0.4 + simbolo.value * 0.6 }],
  }));
  const subir = (v: SharedValue<number>) => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 14 }],
  });
  const estiloTitulo = useAnimatedStyle(() => subir(titulo));
  const estiloSubtitulo = useAnimatedStyle(() => subir(subtitulo));
  const estiloSaludo = useAnimatedStyle(() => subir(saludo));

  const primerNombre = nombre?.trim().split(/\s+/)[0];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: C.bg }, estiloContenedor]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => terminar(true)} accessibilityLabel="Saltar animación">
        <Animated.View style={[styles.centro, estiloContenido]}>
          {/* Resplandor azul detrás de la esfera */}
          <Animated.View style={[styles.resplandor, estiloResplandor]} pointerEvents="none">
            <Svg width={520} height={520}>
              <Defs>
                <RadialGradient id="resplandor" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={C.primary} stopOpacity={0.32} />
                  <Stop offset="0.45" stopColor={C.primary} stopOpacity={0.1} />
                  <Stop offset="1" stopColor={C.primary} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width={520} height={520} fill="url(#resplandor)" />
            </Svg>
          </Animated.View>

          {/* Esfera del reloj */}
          <Animated.View style={[{ width: DIAMETRO, height: DIAMETRO }, estiloEsfera]}>
            {Array.from({ length: MARCAS }, (_, i) => (
              <Marca key={i} indice={i} barrido={barrido} />
            ))}

            {/* Manecilla: punto brillante que recorre la esfera */}
            <Animated.View style={[StyleSheet.absoluteFill, estiloManecilla]} pointerEvents="none">
              <View style={styles.puntaManecilla} />
              <View style={styles.colaManecilla} />
            </Animated.View>

            <View style={[StyleSheet.absoluteFill, styles.centro]}>
              <Animated.View style={[styles.sombraSimbolo, estiloSimbolo]}>
                <Simbolo size={SIMBOLO} />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Textos */}
          <View style={{ alignItems: 'center', marginTop: 34 }}>
            <Animated.Text style={[styles.titulo, estiloTitulo]}>
              Net<Text style={{ color: C.cyan }}>{'&'}</Text>Sec
            </Animated.Text>
            <Animated.Text style={[styles.subtitulo, estiloSubtitulo]}>CONTROL DE HORAS</Animated.Text>
            <Animated.Text style={[styles.saludo, estiloSaludo]}>
              {saludoPorHora()}{primerNombre ? `, ${primerNombre}` : ''}
            </Animated.Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resplandor: { position: 'absolute', width: 520, height: 520, alignItems: 'center', justifyContent: 'center' },
  puntaManecilla: {
    position: 'absolute',
    top: 0,
    left: RADIO - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    shadowColor: C.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  colaManecilla: {
    position: 'absolute',
    top: 13,
    left: RADIO - 1,
    width: 2,
    height: 30,
    borderRadius: 1,
    backgroundColor: alpha(C.cyan, 0.6),
  },
  sombraSimbolo: {
    borderRadius: SIMBOLO / 2,
    shadowColor: C.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  titulo: { color: C.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  subtitulo: { color: C.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 5, marginTop: 6 },
  saludo: { color: C.cyan, fontSize: 16, fontWeight: '600', marginTop: 22 },
});
