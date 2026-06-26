// app/_layout.tsx
import { useColorScheme } from '@/components/useColorScheme';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { auth } from '../lib/firebase'; // Enlace a tus credenciales de Google

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  return (
    <MainAuthGate loaded={loaded} />
  );
}

// Componente guardián que analiza los permisos de navegación en tiempo real
function MainAuthGate({ loaded }: { loaded: boolean }) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);

  // 1. Escucha de Firebase para detectar cambios de usuario en la nube
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
      SplashScreen.hideAsync();
    });
    return unsubscribe;
  }, []);

  // 2. Sistema de redirección automática protectora
  useEffect(() => {
    if (initializing || !loaded) return;

    // Detecta si el usuario está actualmente dentro de las pantallas protegidas (tabs)
    const inTabsGroup = segments[0] === '(tabs)';

    if (!user && inTabsGroup) {
      // Bloqueo: Si no hay usuario y trata de ver las horas, lo mandamos al Login
      router.replace('/login');
    } else if (user && !inTabsGroup) {
      // Si ya inició sesión y está en las pantallas de acceso, lo mandamos directo al inicio
      router.replace('/(tabs)');
    }
  }, [user, initializing, segments, loaded]);

  // Pantalla de carga estética mientras Firebase responde
  if (initializing || !loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b132b', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00b4d8" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </ThemeProvider>
  );
}
