// app/login.tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { SmartLogin } from '../components/SmartLogin';


export default function LoginScreen() {
  const router = useRouter();
  const [errorMessage] = useState<string | null>(null);

  /*
  const handleLogin = async () => {
    // Validaciones básicas de entrada
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Intento de autenticación en la nube de Google
       // @ts-ignore - Apaga temporalmente el chequeo estricto para esta línea en el emulador
      await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Redirección inmediata al panel protegido de pestañas
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error(error);
      // Control de errores comunes de acceso
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorMessage('Correo o contraseña incorrectos. Verifica tus datos.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('El formato del correo electrónico no es válido.');
      } else {
        setErrorMessage('Error al intentar iniciar sesión. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };
*/

  return (
    <ScreenContainer>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Bloque del Título Espejo */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', marginBottom: 8 }}>
              Iniciar sesión
            </Text>
            <Text style={{ fontSize: 14, color: '#8d99ae', lineHeight: 20 }}>
              Ingresa tus credenciales para acceder y sincronizar tu reporte de horas extras.
            </Text>
          </View>

          {/* Banner de alertas en pantalla */}
          {errorMessage && (
            <View style={{ backgroundColor: '#ff007f15', borderWidth: 1, borderColor: '#ff007f', padding: 12, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ color: '#ff007f', fontSize: 13, fontWeight: '500' }}>{errorMessage}</Text>
            </View>
          )}

          {/* Formulario Estructurado */}
      {/* ¡REEMPLAZO TOTAL CON EL LOGIN INTELIGENTE POR CÉDULA! */}
      <SmartLogin 
        onLoginSuccess={() => {
          router.replace('/(tabs)');
        }}
        onNavigateToRegister={() => {
          router.push('/register');
        }}
      />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
