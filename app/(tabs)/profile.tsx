// app/(tabs)/profile.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TabBarIcon } from '../../components/TabBarIcon';

export default function ProfileScreen() {
  // Estados para almacenar los datos del operario traídos de Firestore
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Estados para la lógica de cambio de contraseña
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // 1. CARGA EN VIVO DESDE FIRESTORE
  useEffect(() => {
    let isMounted = true;

    const fetchUserProfile = async () => {
      try {
        const { auth, db } = require('../../lib/firebase');
        const { doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');

        const currentUser = auth.currentUser;
        if (!currentUser) {
          setLoading(false);
          return;
        }

        // Buscamos el documento en la colección 'users' donde el email coincida con el de la sesión
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', currentUser.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          if (isMounted) {
            setUserData({ id: docSnap.id, ...docSnap.data() });
          }
        } else {
          // Si no se encuentra por email, intentamos buscar directamente por UID por si acaso
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && isMounted) {
            setUserData({ id: docSnap.id, ...docSnap.data() });
          }
        }
      } catch (error) {
        console.error("Error al cargar el perfil en vivo: ", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUserProfile();
    return () => { isMounted = false; };
  }, []);

  // 2. LÓGICA DE ACTUALIZACIÓN DE CONTRASEÑA
  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      alert('Por favor ingresa una nueva contraseña.');
      return;
    }
    if (newPassword.length < 6) {
      alert('La nueva contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { auth } = require('../../lib/firebase');
      const { updatePassword } = require('firebase/auth');
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updatePassword(currentUser, newPassword.trim());
        setNewPassword('');
        alert('¡Contraseña actualizada con éxito en el sistema de seguridad!');
      } else {
        alert('No hay una sesión activa para realizar esta acción.');
      }
    } catch (error: any) {
      console.error("Error al cambiar contraseña: ", error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Por seguridad, esta acción requiere que hayas iniciado sesión recientemente. Por favor, cierra sesión y vuelve a ingresar.');
      } else {
        alert('No se pudo cambiar la contraseña. Inténtalo de nuevo más tarde.');
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 3. LÓGICA DE CIERRE DE SESIÓN SEGURO
  const handleSignOut = async () => {
    try {
      const { auth } = require('../../lib/firebase');
      const { signOut } = require('firebase/auth');
      await signOut(auth);
      if (Platform.OS === 'web') {
        alert('Sesión cerrada correctamente.');
      }
    } catch (error) {
      console.error("Error al cerrar sesión: ", error);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#3a86ff" />
          <Text style={styles.loadingText}>Cargando datos de nómina en vivo...</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Extraemos las iniciales del nombre para el avatar circular
  const getInitials = (name: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabecera unificada ultra compacta */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <View style={styles.iconBadgeContainer}>
          <TabBarIcon name="shield-checkmark" size={16} color="#00f5d4" />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Tarjeta Principal del Usuario */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(userData?.fullName || '')}</Text>
          </View>
          <Text style={styles.userName}>{userData?.fullName || 'Operario Mar Profundo'}</Text>
          <Text style={styles.userEmail}>{userData?.email || 'Sincronizando...'}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{userData?.position || 'TRABAJADOR'}</Text>
          </View>
        </View>

        {/* Bloque de Información Laboral y Personal Completa */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>INFORMACIÓN CORPORATIVA</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Número de Cédula</Text>
            <Text style={styles.infoValue}>{userData?.cedula || 'No registrada'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Teléfono / Celular</Text>
            <Text style={styles.infoValue}>{userData?.phone || 'No registrado'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dirección Residencial</Text>
            <Text style={styles.infoValue}>{userData?.address || 'No registrada'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de Nacimiento</Text>
            <Text style={styles.infoValue}>{userData?.birthDate || 'No registrada'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado en Nómina</Text>
            <Text style={[styles.infoValue, { color: '#00f5d4' }]}>{userData?.status || 'ACTIVO'}</Text>
          </View>
        </View>

        {/* Bloque de Seguridad: Cambio de Clave */}
        <View style={styles.securitySection}>
          <Text style={styles.sectionTitle}>SEGURIDAD DE LA CUENTA</Text>
          <Text style={styles.securitySubtext}>Digita una nueva contraseña para actualizar tu clave de acceso al sistema.</Text>
          
          <View style={styles.inputContainer}>
            <View style={{ marginRight: 10 }}>
              <TabBarIcon name="lock-closed-outline" size={16} color="#8d99ae" />
            </View>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Escribe tu nueva contraseña"
              placeholderTextColor="#3a4f7c"
              style={styles.input}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            onPress={handleChangePassword}
            disabled={updatingPassword}
            style={styles.updateButton}
            activeOpacity={0.85}
          >
            {updatingPassword ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.updateButtonText}>Actualizar Contraseña</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Botón de Salida Segura */}
        <TouchableOpacity 
          onPress={handleSignOut}
          activeOpacity={0.8} 
          style={styles.logoutButton}
        >
          <TabBarIcon name="log-out-outline" size={18} color="#ff007f" />
          <Text style={styles.logoutButtonText}>Cerrar Sesión Activa</Text>
        </TouchableOpacity>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 16,
    backgroundColor: '#0b132b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  iconBadgeContainer: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#1c2541',
    borderWidth: 1,
    borderColor: '#3a4f7c30',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b132b',
  },
  loadingText: {
    color: '#8d99ae',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  profileCard: {
    backgroundColor: '#1c2541',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a4f7c20',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3a86ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
userEmail: {
    fontSize: 13,
    color: '#8d99ae',
    marginBottom: 12,
    textAlign: 'center',
},
badge: {
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00f5d430',
},
badgeText: {
    color: '#00f5d4',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
},
infoSection: {
    backgroundColor: '#1c2541',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a4f7c20',
    marginBottom: 16,
},
securitySection: {
    backgroundColor: '#1c2541',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a4f7c20',
    marginBottom: 24,
},
securitySubtext: {
    fontSize: 12,
    color: '#8d99ae',
    lineHeight: 16,
    marginBottom: 14,
},
sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 0.5,
    marginBottom: 12,
},
infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 79, 124, 0.15)',
},
infoLabel: {
    fontSize: 13,
    color: '#cbd5e1',
},
infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    maxWidth: '60%',
    textAlign: 'right',
},
inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b132b',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3a4f7c30',
    marginBottom: 12,
},
input: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 10,
    fontSize: 15,
},
updateButton: {
    backgroundColor: '#3a86ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3a86ff',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
},
updateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
},
logoutButton: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255, 0, 127, 0.1)',
   paddingVertical: 14,
   borderRadius: 12,
   gap: 8,
   borderWidth: 1,
   borderColor: 'rgba(255, 0, 127, 0.2)',
},
logoutButtonText: {
   color: '#ff007f',
   fontSize: 14,
   fontWeight: '600',
},
});