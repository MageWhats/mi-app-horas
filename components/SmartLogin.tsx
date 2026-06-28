// components/SmartLogin.tsx
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TabBarIcon } from './TabBarIcon';

interface SmartLoginProps {
  onLoginSuccess: (userAuth: any) => void;
  onNavigateToRegister: () => void;
}

export const SmartLogin: React.FC<SmartLoginProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const inputClean = cedula.trim(); // Captura el texto del primer cuadro (puede ser Cédula o Correo)
    const passClean = password.trim();

    if (!inputClean || !passClean) {
      alert('Por favor ingresa tus credenciales y contraseña.');
      return;
    }

    setLoading(true);

    try {
      const { auth: fbAuth, db: fbDb } = require('../lib/firebase');
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const { doc, getDoc } = require('firebase/firestore');

      let finalEmail = '';
      let isOldUser = false;
      let userDisplayFormName = '';

      // 🔍 DETECTOR INTELIGENTE: ¿Es un correo (usuario viejo) o una cédula (usuario nuevo)?
      if (inputClean.includes('@')) {
        // ES UN USUARIO ANTIGUO: Usamos el correo directo que digitó
        finalEmail = inputClean.toLowerCase();
        isOldUser = true;
      } else {
        // ES UN USUARIO NUEVO: Buscamos la cédula en Cloud Firestore
        const userDocRef = doc(fbDb, 'users', inputClean);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          setLoading(false);
          alert('El número de cédula ingresado no está registrado en la empresa corporativa.');
          return;
        }

        const userData = userDocSnap.data();
        finalEmail = userData.email;
        userDisplayFormName = userData.fullName;
      }

      if (!finalEmail) {
        setLoading(false);
        alert('Error: No se encontró un correo electrónico válido para acceder.');
        return;
      }

      // 🔑 LOG IN COMPARTIDO: Autenticamos en Firebase Auth con las credenciales resultantes
      const userCredential = await signInWithEmailAndPassword(fbAuth, finalEmail, passClean);
      const loggedUser = userCredential.user;

      // Si es un usuario antiguo, verificamos de rapidez si de verdad le falta crear su perfil por cédula
      if (isOldUser) {
        // Consultamos la colección por si ya se había migrado antes
        // (Esto nos servirá en el siguiente paso para abrirle la ventana flotante)
        console.log("Usuario antiguo detectado ingresando por correo:", loggedUser.uid);
      }

      setLoading(false);
      alert(isOldUser ? '¡Bienvenido! Por favor actualiza tus datos corporativos.' : `¡Bienvenido de nuevo, ${userDisplayFormName}!`);
      onLoginSuccess(loggedUser);

    } catch (error: any) {
      setLoading(false);
      console.error("Error en Login Híbrido: ", error);

      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        alert('La contraseña ingresada es incorrecta o las credenciales no existen.');
      } else {
        alert('No se pudo verificar el acceso. Revisa tu conexión de red.');
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.loginCard}>
        {/* Cabecera / Identidad visual */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <TabBarIcon name="shield-checkmark" size={32} color="#00f5d4" />
          </View>
          <Text style={styles.title}>Mar Profundo</Text>
          <Text style={styles.subtitle}>SISTEMA DE CONTROL HORARIO</Text>
        </View>

             {/* CAMPO DE CÉDULA INTELIGENTE CON GUÍA PARA USUARIOS ANTIGUOS */}
          <Text style={styles.label}>Número de Cédula</Text>
          <View style={styles.inputContainer}>
            <View style={{ marginRight: 10 }}>
              <TabBarIcon name="card-outline" size={18} color="#8d99ae" />
            </View>
            <TextInput 
              value={cedula} 
              onChangeText={setCedula} 
              keyboardType="default" // Lo cambiamos a default para que permita escribir letras si meten el correo
              placeholder="Cédula o Correo electrónico" 
              placeholderTextColor="#3a4f7c" 
              style={styles.input} 
              autoCapitalize="none"
            />
          </View>
          
          {/* NOTA DE AYUDA EXCLUSIVA PARA MIGRACIÓN */}
          <Text style={{ fontSize: 11, color: '#00b4d8', marginTop: 6, lineHeight: 14, fontWeight: '500' }}>
            💡 Si ya tenías cuenta en la versión anterior, ingresa aquí con tu **correo electrónico** para vincular tu cédula sin perder tus horas.
          </Text>



          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.inputContainer}>
            <View style={{ marginRight: 10 }}>
              <TabBarIcon name="lock-closed-outline" size={18} color="#8d99ae" />
            </View>
            <TextInput 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
              placeholder="Ingresa tu contraseña" 
              placeholderTextColor="#3a4f7c" 
              style={styles.input} 
              autoCapitalize="none"
            />
          </View>

          {/* Botón de Entrada */}
          <TouchableOpacity 
            onPress={handleLogin} 
            disabled={loading} 
            style={styles.submitButton} 
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Iniciar Sesión</Text>}
          </TouchableOpacity>
      
          {/* Enlace para registrar operarios nuevos */}
          <TouchableOpacity onPress={onNavigateToRegister} style={styles.registerLink}>
          <Text style={styles.registerLinkText}>
            ¿Eres un nuevo operario? <Text style={{ color: '#3a86ff', fontWeight: '700' }}>Regístrate aquí</Text>
          </Text>
        </TouchableOpacity>
        </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b132b',
    justifyContent: 'center',
    padding: 24,
  },
  loginCard: {
    backgroundColor: '#1c2541',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#3a4f7c20',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.2)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  form: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8d99ae',
    marginBottom: 8,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b132b',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3a4f7c30',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 12,
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: '#3a86ff',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#3a86ff',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
  },
  registerLinkText: {
    color: '#8d99ae',
    fontSize: 13,
  },
});
