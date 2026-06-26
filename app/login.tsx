// app/login.tsx
import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { auth } from '../lib/firebase'; // Sincronizado con tu ruta de utilidades

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          <View style={{ gap: 16, marginBottom: 28 }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#8d99ae', marginBottom: 8, letterSpacing: 0.5 }}>CORREO ELECTRÓNICO</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#3a4f7c"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#3a4f7c40' }}
              />
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#8d99ae', marginBottom: 8, letterSpacing: 0.5 }}>CONTRASEÑA</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#3a4f7c"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#3a4f7c40' }}
              />
            </View>
          </View>

          {/* Botón de Acción Principal Eléctrico */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={{ backgroundColor: '#00b4d8', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 24, minHeight: 54 }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Ingresar</Text>
            )}
          </TouchableOpacity>

          {/* Enlace de navegación hacia el registro */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#8d99ae', fontSize: 14 }}>¿No tienes una cuenta?</Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#00b4d8', fontSize: 14, fontWeight: '600' }}>Regístrate</Text>
              </TouchableOpacity>
            </Link>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
