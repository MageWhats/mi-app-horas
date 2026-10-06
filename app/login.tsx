// app/login.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LogoCompleto } from '../components/brand/Logo';
import { FormField, PasswordField, TextField } from '../components/form/FormField';
import { TabBarIcon } from '../components/TabBarIcon';
import { ThemeToggle } from '../components/ThemeToggle';
import { Turnstile } from '../components/Turnstile';
import { supabase } from '../lib/supabase';
import { alpha, useTheme, useThemedStyles } from '../lib/theme';
import { TurnstileHandle } from '../lib/turnstile';

const CLAVE_DOCUMENTO = 'netsec-horas:documento-recordado';
const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

export default function Login() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const styles = useThemedStyles(crearEstilos);

  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  // Entrada: el logo baja con un fundido y luego aparece la tarjeta
  const logo = useSharedValue(0);
  const tarjeta = useSharedValue(0);
  useEffect(() => {
    logo.value = withTiming(1, { duration: 700, easing: SUAVE });
    tarjeta.value = withDelay(180, withTiming(1, { duration: 700, easing: SUAVE }));
  }, [logo, tarjeta]);
  const estiloLogo = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ translateY: (1 - logo.value) * -16 }, { scale: 0.96 + logo.value * 0.04 }],
  }));
  const estiloTarjeta = useAnimatedStyle(() => ({
    opacity: tarjeta.value,
    transform: [{ translateY: (1 - tarjeta.value) * 24 }],
  }));

  // Documento recordado del último ingreso
  useEffect(() => {
    AsyncStorage.getItem(CLAVE_DOCUMENTO)
      .then((guardado) => { if (guardado) setCedula(guardado); })
      .catch(() => undefined);
  }, []);

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError(null);

    if (!cedula.trim() || !password) {
      setError('Ingresa tu número de documento y tu contraseña.');
      return;
    }

    setLoading(true);
    try {
      // 1. Traducir la cédula al correo de acceso. La base de datos verifica el CAPTCHA (si está activo)
      //    y limita los intentos por IP y por cédula; no expone ningún otro dato del perfil.
      const captchaBusqueda = await turnstile.current?.obtenerToken();
      const { data: acceso, error: rpcError } = await supabase.rpc('buscar_acceso', {
        p_cedula: cedula.trim(),
        p_captcha: captchaBusqueda ?? null,
      });
      if (rpcError) throw rpcError;

      const { estado, email } = acceso as { estado: string; email?: string };
      if (estado === 'limite') {
        setError('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
        return;
      }
      if (estado === 'captcha') {
        setError('No se pudo verificar que no eres un robot. Inténtalo de nuevo.');
        return;
      }
      if (estado !== 'ok' || !email) {
        setError('El documento o la contraseña no son correctos.');
        return;
      }

      // 2. Autenticar (Supabase Auth verifica su propio token de CAPTCHA si la protección está activa).
      //    La navegación y la animación de entrada las hace app/_layout.tsx al detectar la sesión.
      const captchaAcceso = await turnstile.current?.obtenerToken();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: captchaAcceso },
      });
      if (authError) {
        if (authError.code === 'email_not_confirmed') {
          setError('Confirma tu cuenta desde el enlace que te enviamos al correo.');
        } else if (authError.code === 'invalid_credentials') {
          setError('El documento o la contraseña no son correctos.');
        } else if (authError.code === 'captcha_failed') {
          setError('No se pudo verificar que no eres un robot. Inténtalo de nuevo.');
        } else if (authError.status === 429 || authError.code === 'over_request_rate_limit') {
          setError('Demasiados intentos seguidos. Espera unos minutos.');
        } else {
          throw authError;
        }
        return;
      }

      if (recordar) await AsyncStorage.setItem(CLAVE_DOCUMENTO, cedula.trim()).catch(() => undefined);
      else await AsyncStorage.removeItem(CLAVE_DOCUMENTO).catch(() => undefined);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message.includes('anti-bots')
        ? e.message
        : 'No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Resplandor de marca en la parte superior */}
      <View style={styles.resplandor} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="brillo" cx="50%" cy="0%" r="75%">
              <Stop offset="0" stopColor={c.primary} stopOpacity={0.28} />
              <Stop offset="0.6" stopColor={c.cyan} stopOpacity={0.06} />
              <Stop offset="1" stopColor={c.bg} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#brillo)" />
        </Svg>
      </View>

      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.barraSuperior}>
          <ThemeToggle />
        </View>

        <Animated.View style={[styles.cabecera, estiloLogo]}>
          <LogoCompleto height={168} />
        </Animated.View>

        <Animated.View style={[styles.tarjeta, estiloTarjeta]}>
          <Text style={styles.titulo}>Control de Horas</Text>
          <Text style={styles.subtitulo}>Ingresa con tu número de documento para registrar tu jornada.</Text>

          <FormField label="Número de documento">
            <TextField
              value={cedula}
              onChangeText={(t) => { setCedula(t.replace(/\D/g, '')); setError(null); }}
              keyboardType="number-pad"
              placeholder="Ej: 1007744230"
              icon="card-outline"
              maxLength={15}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              autoComplete="username"
              textContentType="username"
              hasError={!!error && !cedula}
            />
          </FormField>

          <FormField label="Contraseña">
            <PasswordField
              ref={passwordRef}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              placeholder="Tu contraseña"
              icon="lock-closed-outline"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              autoComplete="current-password"
              textContentType="password"
              hasError={!!error && !password}
            />
          </FormField>

          <TouchableOpacity onPress={() => router.push('/recuperar')} style={styles.olvido} accessibilityRole="link">
            <Text style={styles.olvidoTexto}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <Pressable
            onPress={() => setRecordar((r) => !r)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: recordar }}
            style={styles.recordar}
          >
            <View style={[styles.casilla, recordar && styles.casillaActiva]}>
              {recordar && <TabBarIcon name="checkmark" size={14} color={c.onPrimary} />}
            </View>
            <Text style={styles.recordarTexto}>Recordar mi documento</Text>
          </Pressable>

          <Turnstile ref={turnstile} />

          {error && (
            <View style={styles.error} accessibilityRole="alert">
              <TabBarIcon name="alert-circle" size={18} color={c.danger} />
              <Text style={styles.errorTexto}>{error}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={[styles.boton, loading && { opacity: 0.75 }]}>
            {loading ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.botonTexto}>Ingresar</Text>}
          </TouchableOpacity>

          <View style={styles.separador}>
            <View style={styles.linea} />
            <Text style={styles.separadorTexto}>¿Eres nuevo?</Text>
            <View style={styles.linea} />
          </View>

          <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.8} style={styles.botonSecundario}>
            <Text style={styles.botonSecundarioTexto}>Crear mi cuenta</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.pie}>
          {'Net&Sec Suministros · Control de Horas · '}
          <Text onPress={() => router.push('/privacidad')} style={{ color: c.primary }}>Privacidad</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const crearEstilos = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  resplandor: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  contenido: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 32, width: '100%', maxWidth: 460, alignSelf: 'center' },
  barraSuperior: { position: 'absolute', top: 44, right: 20, zIndex: 2 },
  cabecera: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  tarjeta: {
    backgroundColor: c.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: c.border,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4,
  },
  titulo: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitulo: { color: c.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 22 },
  olvido: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 10, paddingVertical: 4 },
  olvidoTexto: { color: c.primary, fontSize: 13, fontWeight: '600' },
  recordar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 16, alignSelf: 'flex-start' },
  casilla: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
  casillaActiva: { backgroundColor: c.primary, borderColor: c.primary },
  recordarTexto: { color: c.textMuted, fontSize: 14 },
  error: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 14,
    backgroundColor: alpha(c.danger, 0.1), borderWidth: 1, borderColor: alpha(c.danger, 0.3),
  },
  errorTexto: { color: c.danger, fontSize: 13, flex: 1, lineHeight: 18 },
  boton: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: c.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  botonTexto: { color: c.onPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  separador: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  linea: { flex: 1, height: 1, backgroundColor: c.border },
  separadorTexto: { color: c.textFaint, fontSize: 13 },
  botonSecundario: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: alpha(c.primary, 0.5) },
  botonSecundarioTexto: { color: c.primary, fontSize: 15, fontWeight: '700' },
  pie: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
