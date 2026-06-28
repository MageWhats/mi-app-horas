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
    if (!cedula.trim() || !password.trim()) {
      alert('Por favor ingresa tu número de cédula y contraseña.');
      return;
    }

    setLoading(true);

    try {
      // Importamos las librerías oficiales de Firebase de forma segura
      const { auth: fbAuth, db: fbDb } = require('../lib/firebase');
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const { doc, getDoc } = require('firebase/firestore');

      // 1. BUSQUEDA INTELIGENTE: Buscamos en Firestore el documento bautizado con la Cédula
      const userDocRef = doc(fbDb, 'users', cedula.trim());
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setLoading(false);
        alert('El número de cédula ingresado no está registrado en la empresa.');
        return;
      }

      // 2. RECUPERACIÓN INVISIBLE: Extraemos el correo amarrado a esa cédula
      const userData = userDocSnap.data();
      const associatedEmail = userData.email;

      if (!associatedEmail) {
        setLoading(false);
        alert('Error técnico: No se encontró un correo electrónico asociado a esta cédula.');
        return;
      }

      // 3. LOG IN OFICIAL: Autenticamos en la nube con el correo recuperado y la clave
      const userCredential = await signInWithEmailAndPassword(fbAuth, associatedEmail, password);
      
      setLoading(false);
      alert(`¡Bienvenido de nuevo, ${userData.fullName}!`);
      onLoginSuccess(userCredential.user);

    } catch (error: any) {
      setLoading(false);
      console.error("Error en Login Inteligente: ", error);

      // Control de errores amigable
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        alert('La contraseña ingresada es incorrecta. Inténtalo de nuevo.');
      } else if (error.code === 'auth/user-not-found') {
        alert('Credenciales inválidas en el sistema de seguridad.');
      } else {
        alert('No se pudo iniciar sesión. Revisa tu conexión a internet.');
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

        {/* Campos de Entrada */}
          <Text style={styles.label}>Número de Cédula</Text>
          <View style={styles.inputContainer}>
            <View style={{ marginRight: 10 }}>
              <TabBarIcon name="card-outline" size={18} color="#8d99ae" />
            </View>
            <TextInput 
              value={cedula} 
              onChangeText={setCedula} 
              keyboardType="numeric" 
              placeholder="Ingresa tu cédula" 
              placeholderTextColor="#3a4f7c" 
              style={styles.input} 
            />
          </View>


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
