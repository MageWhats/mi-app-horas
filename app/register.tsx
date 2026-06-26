// app/register.tsx
import { Link, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { auth } from '../lib/firebase'; // Sincronizado con tu ruta de utilidades

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    // Validaciones básicas antes de enviar datos a Google
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMessage('Por favor, completa todos los campos.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Envío de credenciales a la nube de Firebase
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      if (Platform.OS === 'web') {
        alert('¡Cuenta creada con éxito! Bienvenido.');
      } else {
        Alert.alert('Éxito', '¡Cuenta creada con éxito! Bienvenido.');
      }
      
      // Redirecciona automáticamente al panel principal de pestañas
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error(error);
      // Traducción de errores comunes de la API de Firebase
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('Este correo electrónico ya está registrado.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('El formato del correo electrónico no es válido.');
      } else {
        setErrorMessage('Ocurrió un error al registrar el usuario. Inténtalo de nuevo.');
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
          {/* Bloque del Título Principal */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', marginBottom: 8 }}>
              Crear cuenta
            </Text>
            <Text style={{ fontSize: 14, color: '#8d99ae', lineHeight: 20 }}>
              Regístrate para mantener tu control de horas sincronizado de forma segura en la nube.
            </Text>
          </View>

          {/* Banner de alertas internas en pantalla */}
          {errorMessage && (
            <View style={{ backgroundColor: '#ff007f15', borderWidth: 1, borderColor: '#ff007f', padding: 12, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ color: '#ff007f', fontSize: 13, fontWeight: '500' }}>{errorMessage}</Text>
            </View>
          )}

          {/* Formulario estructurado estilo Mar Profundo */}
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
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#3a4f7c"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#3a4f7c40' }}
              />
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#8d99ae', marginBottom: 8, letterSpacing: 0.5 }}>CONFIRMAR CONTRASEÑA</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repite tu contraseña"
                placeholderTextColor="#3a4f7c"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={{ backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#3a4f7c40' }}
              />
            </View>
          </View>

          {/* Botonera de Acción Primaria */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
            style={{ backgroundColor: '#00b4d8', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 24, minHeight: 54 }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Registrarse</Text>
            )}
          </TouchableOpacity>

          {/* Enlace de navegación hacia el login */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#8d99ae', fontSize: 14 }}>¿Ya tienes una cuenta?</Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#00b4d8', fontSize: 14, fontWeight: '600' }}>Inicia sesión</Text>
              </TouchableOpacity>
            </Link>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
