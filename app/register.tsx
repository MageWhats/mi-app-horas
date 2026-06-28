// app/register.tsx
import { Link, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AdvancedRegister } from '../components/AdvancedRegister';
import { ScreenContainer } from '../components/ScreenContainer';
// @ts-ignore - Apaga temporalmente el chequeo estricto para esta línea en el emulador
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
       // @ts-ignore - Apaga temporalmente el chequeo estricto para esta línea en el emulador
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
            <AdvancedRegister 
              onClose={() => {
                // Si el operario cancela o cierra el formulario, regresa al login
                router.back();
              }}
              onRegisterSuccess={(userData) => {
                // Una vez creado el registro con la cédula en Firestore, lo manda directo a la app
                router.replace('/(tabs)');
              }}
            />


          {/* Enlace de navegación hacia el login */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#8d99ae', fontSize: 14 }}>¿Ya tienes una cuenta?</Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#3a86ff', fontSize: 14, fontWeight: '600' }}>Inicia sesión</Text>
              </TouchableOpacity>
            </Link>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
