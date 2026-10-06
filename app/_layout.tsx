// app/_layout.tsx
import type { User } from '@supabase/supabase-js';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import { SplashAnimation } from '../components/brand/SplashAnimation';
import { supabase } from '../lib/supabase';
import { PALETA_OSCURA, ThemeProvider, useTheme } from '../lib/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync();

/** En web la animación se muestra una vez por pestaña: al recargar no se repite (salvo al iniciar sesión). */
const CLAVE_SPLASH_WEB = 'netsec-horas:splash-visto';
const splashYaVisto = () => {
  if (Platform.OS !== 'web') return false;
  try { return sessionStorage.getItem(CLAVE_SPLASH_WEB) === '1'; } catch { return false; }
};
const marcarSplashVisto = () => {
  if (Platform.OS !== 'web') return;
  try { sessionStorage.setItem(CLAVE_SPLASH_WEB, '1'); } catch { /* sin almacenamiento */ }
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <MainAuthGate />
    </ThemeProvider>
  );
}

// Guardián de navegación: decide entre las pantallas públicas y la app del operario
function MainAuthGate() {
  const { esOscuro, colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [splash, setSplash] = useState<{ nombre?: string } | null>(null);

  const usuarioAnterior = useRef<User | null>(null);
  const segmentoActual = useRef<string | undefined>(undefined);
  segmentoActual.current = segments[0] as string | undefined;

  // App instalable (PWA): registra el service worker en la web (no en desarrollo, para no guardar versiones viejas)
  useEffect(() => {
    if (Platform.OS === 'web' && !__DEV__ && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('No se pudo registrar el service worker:', error));
    }
  }, []);

  // onAuthStateChange emite INITIAL_SESSION al suscribirse con la sesión guardada (o null)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nuevo = session?.user ?? null;
      const entro = !!nuevo && !usuarioAnterior.current;
      usuarioAnterior.current = nuevo;

      // Animación de entrada al abrir la app con sesión o al iniciar sesión (no durante el registro,
      // que cierra la sesión enseguida)
      if (entro && segmentoActual.current !== 'register' && (event !== 'INITIAL_SESSION' || !splashYaVisto())) {
        marcarSplashVisto();
        setSplash({ nombre: nuevo?.user_metadata?.nombres });
      }

      setUser(nuevo);
      setInitializing(false);
      SplashScreen.hideAsync();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (initializing) return;

    const currentSegment = segments[0] as string | undefined;
    const isInLogin = currentSegment === 'login' || currentSegment === undefined;
    const isInRegister = currentSegment === 'register';

    if (user && isInLogin) {
      router.replace('/(operario)');
    } else if (!user && !isInLogin && !isInRegister) {
      router.replace('/login');
    }
    // El registro gestiona su propia navegación al terminar (crea la cuenta y cierra la sesión).
  }, [user, initializing, segments]);

  if (initializing) {
    // Mismo color que el splash nativo, para que no haya destellos
    return <View style={{ flex: 1, backgroundColor: PALETA_OSCURA.bg }} />;
  }

  const navigationTheme = esOscuro
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, border: colors.border, primary: colors.primary, text: colors.text } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, border: colors.border, primary: colors.primary, text: colors.text } };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={splash || esOscuro ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(operario)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
        {splash && <SplashAnimation nombre={splash.nombre} onTerminar={() => setSplash(null)} />}
      </View>
    </NavigationThemeProvider>
  );
}
