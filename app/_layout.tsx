// app/_layout.tsx
import { useColorScheme } from '@/components/useColorScheme';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
// @ts-ignore 
import { auth, db } from '../lib/firebase'; // Enlace a tus credenciales de Google

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

  const [userRole, setUserRole] = useState<string | null>(null);

  // 1. Escucha de Firebase para detectar cambios de usuario en la nube
  useEffect(() => {
    // @ts-ignore - Apaga el chequeo estricto del tipo implícito de Firebase en la raíz del proyecto
    const unsubscribe = onAuthStateChanged(auth, async (currrentUser) => {
      if (currrentUser) {
        setUser(currrentUser);
        try {
          const userDocRef = doc(db, 'users', currrentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserRole(userData.role || userData.rol || 'Operario');
          } else {
            setUserRole('Operario'); // Valor por defecto si no se encuentra el documento
          }
        } catch (error) {
          console.error("Error recuperando el rol en el Gate principal:", error);
          setUserRole('Operario'); // Valor por defecto en caso de error
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setInitializing(false);
      SplashScreen.hideAsync();
    });
    return unsubscribe;
  }, []);

  // 2. Sistema de redirección automática protectora
  useEffect(() => {
    if (initializing || !loaded) return;

    // Detecta si el usuario está actualmente dentro de las pantallas protegidas (admin o operario)
    const currentSegment = segments[0];
    const isInOperario = currentSegment === '(operario)';
    const isInAdmin = currentSegment === '(admin)';
    const isInAuth = currentSegment === 'login' || currentSegment === 'register' || currentSegment === undefined;

    // 🔀 2. CONDICIONALES DE REDIRECCIÓN CONTROLADA (Evitan bucles)
    if (user) {
      // Si el usuario ya está dentro de las pantallas de la app, NO redirigir más (Rompe el bucle)
      if (isInOperario || isInAdmin) {
        return;
      }

      if (!userRole) return; // Espera a que se cargue el rol antes de redirigir

      const esAdmin = userRole === 'admin';

      if (isInAuth) {
        if (esAdmin) {
          router.replace('/dashboard' as any);
        } else {
          router.replace('/(operario)' as any);
        }
      }
    } else {
      if (!isInAuth) {
        router.replace('login' as any);
      }
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
        <Stack.Screen name="(admin)"/>
        <Stack.Screen name="(operario)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </ThemeProvider>
  );
}
