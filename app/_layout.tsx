// app/_layout.tsx
import { useColorScheme } from '@/components/useColorScheme';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { auth } from '../lib/firebase';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  return <MainAuthGate loaded={loaded} />;
}

// Guardián de navegación: decide entre las pantallas públicas y la app del operario
function MainAuthGate({ loaded }: { loaded: boolean }) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setInitializing(false);
    SplashScreen.hideAsync();
  }), []);

  useEffect(() => {
    if (initializing || !loaded) return;

    const currentSegment = segments[0] as string | undefined;
    const isInLogin = currentSegment === 'login' || currentSegment === undefined;
    const isInRegister = currentSegment === 'register';

    if (user && isInLogin) {
      router.replace('/(operario)');
    } else if (!user && !isInLogin && !isInRegister) {
      router.replace('/login');
    }
    // El registro gestiona su propia navegación al terminar (crea la cuenta y cierra la sesión).
  }, [user, initializing, segments, loaded]);

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
        <Stack.Screen name="(operario)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </ThemeProvider>
  );
}
