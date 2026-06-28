// components/UpdateProfileModal.tsx
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TabBarIcon } from './TabBarIcon';

interface UpdateProfileModalProps {
  isOpen: boolean;
  userUid: string;
  userEmail: string;
  onUpdateSuccess: () => void;
}

export const UpdateProfileModal: React.FC<UpdateProfileModalProps> = ({ isOpen, userUid, userEmail, onUpdateSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [birthDate, setBirthDate] = useState(''); // Formato AAAA-MM-DD
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!fullName.trim() || !cedula.trim() || !position.trim()) {
      alert('Por favor llena los campos obligatorios: Nombre, Cédula y Puesto.');
      return;
    }

    setLoading(true);

    try {
      // Importamos las librerías oficiales de Firebase de forma segura
      const { db: fbDb } = require('../lib/firebase');
      const { doc, setDoc, getDoc } = require('firebase/firestore');

      // 1. VALIDACIÓN EXCLUSIVA: Verificamos que la cédula no esté tomada por otra cuenta nueva
      const userDocRef = doc(fbDb, 'users', cedula.trim());
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        setLoading(false);
        alert('Este número de cédula ya se encuentra registrado con otro operario en el sistema.');
        return;
      }

      // 2. MIGRACIÓN COMPLETA: Armamos la tarjeta corporativa unificando el UID viejo con la cédula
      const fullMigratedData = {
        uid: userUid,
        fullName: fullName.trim(),
        cedula: cedula.trim(), // ¡Nueva llave maestra!
        birthDate: birthDate.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: userEmail.toLowerCase(), // Conserva su correo electrónico de siempre
        position: position.trim().toUpperCase(),
        hireDate: new Date().toISOString().split('T')[0], // Se registra su fecha de migración al sistema por cédula
        status: 'ACTIVO'
      };

      // 3. GUARDADO INDEXADO: Creamos el documento bautizado con la cédula en Firestore
      await setDoc(doc(fbDb, 'users', cedula.trim()), fullMigratedData);

      setLoading(false);
      alert('¡Tus datos corporativos han sido actualizados! A partir de ahora podrás iniciar sesión con tu cédula.');
      onUpdateSuccess();

    } catch (error) {
      setLoading(false);
      console.error("Error al actualizar perfil de usuario antiguo: ", error);
      alert('No se pudieron guardar tus datos corporativos. Revisa tu conexión de red.');
    }
  };

  return (
    <Modal visible={isOpen} animationType="fade" transparent={true} style={{ zIndex: 99999 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            
            {/* Cabecera de Alerta de Nómina */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <TabBarIcon name="shield-alert" size={28} color="#f97316" />
              </View>
              <Text style={styles.title}>Actualización Obligatoria</Text>
              <Text style={styles.subtitle}>SISTEMA DE ASISTENCIA POR CÉDULA</Text>
            </View>

            <Text style={styles.welcomeText}>
              Detectamos que eres un operario antiguo. Para no perder tus horas registradas, por favor vincula tu número de cédula y datos de nómina al sistema corporativo.
            </Text>

            {/* Formulario de Captura Corporativa */}
            <View style={styles.form}>
              <Text style={styles.label}>Nombre Completo *</Text>
              <TextInput value={fullName} onChangeText={setFullName} placeholder="Ej. Pedro Pérez" placeholderTextColor="#3a4f7c" style={styles.input} />

              <Text style={styles.label}>Número de Cédula *</Text>
              <TextInput value={cedula} onChangeText={setCedula} keyboardType="numeric" placeholder="Ingresa tu cédula (Sin puntos)" placeholderTextColor="#3a4f7c" style={styles.input} />

              <Text style={styles.label}>Puesto / Cargo que Ocupa *</Text>
              <TextInput value={position} onChangeText={setPosition} placeholder="Ej. OPERARIO" placeholderTextColor="#3a4f7c" style={styles.input} />

              <Text style={styles.label}>Número de Teléfono</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Ej. 312450AAAA" placeholderTextColor="#3a4f7c" style={styles.input} />

              <Text style={styles.label}>Dirección Residencial</Text>
              <TextInput value={address} onChangeText={setAddress} placeholder="Ej. Calle 10 # 45-20" placeholderTextColor="#3a4f7c" style={styles.input} />

              <Text style={styles.label}>Fecha de Nacimiento</Text>
              <TextInput value={birthDate} onChangeText={setBirthDate} placeholder="AAAA-MM-DD" placeholderTextColor="#3a4f7c" style={styles.input} />
            </View>

            {/* Botón de Guardado */}
            <TouchableOpacity onPress={handleUpdate} disabled={loading} style={styles.submitButton} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Actualizar y Vincular Datos</Text>}
            </TouchableOpacity>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 9, 20, 0.85)', // Fondo ultra oscuro para bloquear el acceso visual a las pestañas de atrás
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#0b132b',
    borderRadius: 24,
    padding: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 1,
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: '#1c254140',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a4f7c15',
    marginBottom: 16,
  },
  form: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8d99ae',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1c2541',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3a4f7c30',
  },
  submitButton: {
    backgroundColor: '#f97316', // Color naranja de alerta/acción de nómina
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#f97316',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
