import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';
import { TabBarIcon } from '../components/TabBarIcon';
// @ts-ignore
import { auth, db } from '../lib/firebase'; // Asegúrate de que apunte bien a tu config de Firebase

export default function SmartLogin() {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('');
  const router = useRouter();

  const mostrarAlerta = (titulo: string, mensaje: string) => {
    if (Platform.OS === 'web') {
      // Si corre en Vercel o localhost, usa el cuadro nativo del navegador
      window.alert(`${titulo}: ${mensaje}`);
    } else {
      // Si corre en Android o iOS, dispara el modal nativo del celular
      Alert.alert(titulo, mensaje);
    }
  };

  const handleLogin = async () => {
    if (!cedula.trim() || !password.trim()) {
      mostrarAlerta('Campos incompletos', 'Por favor ingresa tu número de cédula y contraseña.');
      return;
    }

    try {
      setLoading(true);

      // 1. Buscar el correo electrónico del operario indexado por su número de cédula
      const userDocRef = doc(db, 'users', cedula.trim());
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        mostrarAlerta('Operario no encontrado', 'No existe ningún usuario registrado con el número de cédula ingresado.');
        setLoading(false);
        return;
      }

      const userData = userSnap.data();
      const emailAsociado = userData.email;

      if (!emailAsociado) {
        mostrarAlerta('Error de cuenta', 'Este perfil no cuenta con un correo electrónico asociado para la autenticación.');
        setLoading(false);
        return;
      }

      // 2. Autenticar en Firebase Auth utilizando el correo recuperado y la contraseña escrita
      // @ts-ignore
      await signInWithEmailAndPassword(auth, emailAsociado, password);

       // 🔀 Redirección controlada basada en roles
    if (userData.role === 'admin') {
      // Si es administrador, lo mandamos al dashboard principal (raíz de la carpeta (admin))
      router.replace('/dashboard' as any);
    } else {
      // Si es operario, lo mandamos a su app de campo (raíz de la carpeta (operario))
      router.replace('/(operario)' as any);
    }

    } catch (error: any) {
      console.error(error);
      mostrarAlerta('Error de acceso', 'La cédula o la contraseña ingresadas son incorrectas. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  // Estilos inline híbridos para asegurar consistencia perfecta en Web, Android e iOS
  const containerStyle = { flex: 1, backgroundColor: '#090d16' };
  const cardStyle: ViewStyle = { backgroundColor: '#141e33', borderColor: '#1f293d', borderWidth: 1, borderRadius: 24, padding: 32, width: '100%', maxWidth: 500, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 };
  const inputStyle = { backgroundColor: '#0c1322', color: '#ffffff', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#1a2436', };
  const buttonStyle: ViewStyle = { backgroundColor: '#3b82f6', paddingVertical: 16, borderRadius: 14, width: '100%', alignItems: 'center', marginTop: 8 };

  return (
    <ScrollView style={containerStyle} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 }}>

      {/* Encabezado Superior Externo */}
      <View style={{ maxWidth: 500, width: '100%', alignSelf: 'center', marginBottom: 32, paddingHorizontal: 4 }}>
        <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: 'bold', letterSpacing: -0.5 }}>Iniciar sesión</Text>
        <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 6, lineHeight: 20 }}>
          Ingresa tus credenciales para acceder y sincronizar tu reporte de horas extras.
        </Text>
      </View>

      {/* Tarjeta Central Flotante */}
      <View style={cardStyle}>

        {/* Isotipo del Escudo Verde */}
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 }}>
          {/* Marcador del icono de escudo de tu interfaz */}
          <TabBarIcon name="shield-checkmark" size={32} color="#00f5d4" />
        </View>

        {/* Título de Marca Interno */}
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}>Mar Profundo</Text>
        <Text style={{ color: '#4b5563', fontSize: 11, fontWeight: '700', textAlign: 'center', letterSpacing: 1.5, marginTop: 4, marginBottom: 32 }}>
          SISTEMA DE CONTROL HORARIO
        </Text>

        {/* CAMPO DE CÉDULA INTELIGENTE */}
        <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8, fontWeight: '500' }}>
          Número de Cédula
        </Text>

        {/* La View madre se convierte en el recuadro contenedor con fondo y borde */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#0c1322', // El fondo oscuro que usabas
          borderWidth: 1,
          borderColor: '#1a2436', // El borde gris/azul
          borderRadius: 12,
          paddingHorizontal: 16,
          width: '100%',
          height: 52 // Forzamos una altura fija cómoda para el clic
        }}>

          {/* Icono posicionado a la izquierda */}
          <View style={{ marginRight: 12 }}>
            <TabBarIcon name="card-outline" size={20} color="#8d99ae" />
          </View>

          {/* El TextInput ahora es invisible (sin bordes ni fondos) y se expande en el espacio restante */}
          <TextInput
            placeholder="Cédula"
            placeholderTextColor="#4b5563"
            value={cedula}
            onChangeText={(txt) => setCedula(txt.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            style={{
              flex: 1, // Se estira para ocupar todo el cuadro
              color: '#ffffff',
              fontSize: 15,
              height: '100%',
              ...({ outlineStyle: 'none' } as any)
            }}
          />
        </View>



        {/* CAMPO DE CONTRASEÑA INTELIGENTE */}
        <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8, fontWeight: '500' }}>
          Contraseña
        </Text>

        {/* La View madre se convierte en el recuadro contenedor con fondo y borde */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#0c1322', // El fondo oscuro que usabas
          borderWidth: 1,
          borderColor: '#1a2436', // El borde gris/azul
          borderRadius: 12,
          paddingHorizontal: 16,
          width: '100%',
          height: 52 // Forzamos una altura fija cómoda para el clic
        }}>

          {/* Icono posicionado a la izquierda */}
          <View style={{ marginRight: 12 }}>
            <TabBarIcon name="card-outline" size={20} color="#8d99ae" />
          </View>

          {/* El TextInput ahora es invisible (sin bordes ni fondos) y se expande en el espacio restante */}
          <TextInput
            placeholder="Contraseña"
            placeholderTextColor="#4b5563"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              flex: 1, // Se estira para ocupar todo el cuadro
              color: '#ffffff',
              fontSize: 15,
              height: '100%',
              ...({ outlineStyle: 'none' } as any)
            }}
          />
        </View>

        {/* Botón de Acción Principal */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={buttonStyle}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>

        {/* Enlace Inferior de Redirección al Preregistro */}
        <TouchableOpacity
          onPress={() => router.push('/register')}
          style={{ marginTop: 24, alignSelf: 'center' }}
        >
          <Text style={{ color: '#6b7280', fontSize: 13 }}>
            ¿Eres un nuevo operario? <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>Regístrate aquí</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
