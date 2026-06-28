// components/AdvancedRegister.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TabBarIcon } from './TabBarIcon';



interface AdvancedRegisterProps {
  onClose: () => void;
  onRegisterSuccess: (userData: any) => void;
}

export const AdvancedRegister: React.FC<AdvancedRegisterProps> = ({ onClose, onRegisterSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Estados independientes para cada dato solicitado
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [birthDate, setBirthDate] = useState(''); // Formato AAAA-MM-DD
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [password, setPassword] = useState('');

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };



  const handleSubmit = async () => {
    // 1. Validaciones estrictas de campos obligatorios
    if (!fullName.trim() || !cedula.trim() || !email.trim() || !password.trim() || !position.trim()) {
      alert('Por favor llena los campos obligatorios del registro.');
      return;
    }

    if (password.length < 6) {
      alert('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // 2. Traemos las librerías en caliente de forma segura para evitar colapsos
      const { auth: fbAuth, db: fbDb } = require('../lib/firebase');
      const { createUserWithEmailAndPassword: fbCreate } = require('firebase/auth');
      const { doc: fbDoc, setDoc: fbSet } = require('firebase/firestore');

      // 3. PASO A: Crear el registro de seguridad en Firebase Auth
      const userCredential = await fbCreate(fbAuth, email.trim().toLowerCase(), password);
      const userAuth = userCredential.user;

      // 4. Paquete completo de datos corporativos solicitado por Johan
      const fullUserData = {
        uid: userAuth.uid,                  // Enlace invisible con Auth
        fullName: fullName.trim(),
        cedula: cedula.trim(),             // ¡La Llave Maestra!
        birthDate: birthDate.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim().toLowerCase(),
        position: position.trim().toUpperCase(),
        hireDate: new Date().toISOString().split('T')[0], // Fecha de ingreso automática hoy
        status: 'ACTIVO'
      };

      // 5. PASO B: Guardar en Cloud Firestore indexando estrictamente por el número de Cédula
      await fbSet(fbDoc(fbDb, 'users', cedula.trim()), fullUserData);

      setLoading(false);
      alert('¡Operario registrado con éxito en el sistema corporativo!');
      onRegisterSuccess(fullUserData);

    } catch (error: any) {
      setLoading(false);
      console.error("Error en registro avanzado: ", error);
      
      // Control de errores amigable para el usuario
      if (error.code === 'auth/email-already-in-use') {
        alert('Este correo electrónico ya está registrado con otro trabajador.');
      } else if (error.code === 'auth/invalid-email') {
        alert('El formato del correo electrónico no es válido.');
      } else {
        alert('No se pudo crear el registro. Revisa tu conexión a internet.');
      }
    }
  };


  return (
    <View style={styles.container}>
      {/* Cabecera del formulario */}
      <View style={styles.header}>
        <View>
          <Text style={styles.subtitle}>CREACIÓN DE CUENTA</Text>
          <Text style={styles.title}>Registro Corporativo</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <TabBarIcon name="close" size={20} color="#8d99ae" />
        </TouchableOpacity>
      </View>

      {/* Indicador visual de pasos */}
      <View style={styles.stepIndicatorContainer}>
        <View style={[styles.stepLine, currentStep >= 1 ? styles.stepLineActive : null]} />
        <View style={[styles.stepLine, currentStep >= 2 ? styles.stepLineActive : null]} />
        <View style={[styles.stepLine, currentStep === 3 ? styles.stepLineActive : null]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        
        {/* PASO 1: DATOS DE IDENTIDAD */}
        {currentStep === 1 && (
          <View>
            <Text style={styles.stepTitle}>Paso 1: Datos de Identidad</Text>
            
            <Text style={styles.label}>Nombre Completo *</Text>
            <TextInput value={fullName} onChangeText={setFullName} placeholder="Ej. Johan Marín" placeholderTextColor="#3a4f7c" style={styles.input} />

            <Text style={styles.label}>Número de Cédula *</Text>
            <TextInput value={cedula} onChangeText={setCedula} keyboardType="numeric" placeholder="Ej. 1020450AAA" placeholderTextColor="#3a4f7c" style={styles.input} />

            <Text style={styles.label}>Fecha de Nacimiento</Text>
            <TextInput value={birthDate} onChangeText={setBirthDate} placeholder="AAAA-MM-DD" placeholderTextColor="#3a4f7c" style={styles.input} />
          </View>
        )}

        {/* PASO 2: CONTACTO */}
        {currentStep === 2 && (
          <View>
            <Text style={styles.stepTitle}>Paso 2: Información de Contacto</Text>
            
            <Text style={styles.label}>Número de Teléfono / Celular</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Ej. 312450AAAA" placeholderTextColor="#3a4f7c" style={styles.input} />

            <Text style={styles.label}>Dirección Residencial</Text>
            <TextInput value={address} onChangeText={setAddress} placeholder="Ej. Calle 10 # 45-20" placeholderTextColor="#3a4f7c" style={styles.input} />

            <Text style={styles.label}>Correo Electrónico *</Text>
            <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="johan.marin@empresa.com" placeholderTextColor="#3a4f7c" style={styles.input} autoCapitalize="none" />
          </View>
        )}

        {/* PASO 3: LABORAL Y SEGURIDAD */}
        {currentStep === 3 && (
          <View>
            <Text style={styles.stepTitle}>Paso 3: Puesto y Seguridad</Text>
            
            <Text style={styles.label}>Puesto / Cargo que Ocupa *</Text>
            <TextInput value={position} onChangeText={setPosition} placeholder="Ej. OPERARIO PRINCIPAL" placeholderTextColor="#3a4f7c" style={styles.input} />

            <Text style={styles.label}>Contraseña de Acceso *</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 6 caracteres" placeholderTextColor="#3a4f7c" style={styles.input} autoCapitalize="none" />
          </View>
        )}

      </ScrollView>

      {/* Barra de navegación inferior */}
      <View style={styles.footerNav}>
        {currentStep > 1 ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Atrás</Text>
          </TouchableOpacity>
        ) : <View style={{ flex: 1 }} />}

        {currentStep < 3 ? (
          <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
            <Text style={styles.nextButtonText}>Siguiente</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSubmit} disabled={loading} style={styles.submitButton}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Registrar Operario</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b132b',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
    borderRadius: 99,
    backgroundColor: '#1c2541',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  stepLine: {
    flex: 1,
    height: 4,
    backgroundColor: '#1c2541',
    borderRadius: 2,
  },
  stepLineActive: {
    backgroundColor: '#3a86ff',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8d99ae',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#1c2541',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3a4f7c30',
  },
  footerNav: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a4f7c40',
  },
  backButtonText: {
    color: '#8d99ae',
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#1c2541',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a4f7c40',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#3a86ff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
