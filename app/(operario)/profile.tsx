// app/(operario)/profile.tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatFechaLarga } from '../../components/form/DateField';
import { PasswordField } from '../../components/form/FormField';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TabBarIcon } from '../../components/TabBarIcon';
import { ThemeToggle } from '../../components/ThemeToggle';
import { confirmar, mostrarAlerta } from '../../lib/alert';
import { supabase } from '../../lib/supabase';
import { alpha, Paleta, useTheme, useThemedStyles } from '../../lib/theme';

interface Profile {
  cedula: string;
  email: string;
  full_name: string;
  celular: string | null;
  direccion: string | null;
  barrio: string | null;
  fecha_nacimiento: string | null;
}

/** Iniciales para el avatar: "Juan Carlos Pérez" → "JC" */
const getInitials = (name?: string) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OP';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function ProfileScreen() {
  const { colors: c, esOscuro } = useTheme();
  const styles = useThemedStyles(crearEstilos);

  const [userData, setUserData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchUserProfile = async () => {
      try {
        // RLS solo devuelve el perfil del operario con sesión activa
        const { data, error } = await supabase
          .from('profiles')
          .select('cedula, email, full_name, celular, direccion, barrio, fecha_nacimiento')
          .maybeSingle();
        if (error) throw error;
        if (isMounted) setUserData(data);
      } catch (error) {
        console.error('Error al cargar el perfil:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUserProfile();
    return () => { isMounted = false; };
  }, []);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      mostrarAlerta('La nueva contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    setUpdatingPassword(true);
    try {
      // Sin trim: la contraseña se guarda exactamente como se escribió
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error('Error al cambiar contraseña:', error);
        if (error.code === 'reauthentication_needed') {
          mostrarAlerta('Por seguridad, esta acción requiere que hayas iniciado sesión recientemente. Cierra sesión y vuelve a ingresar.');
        } else if (error.code === 'same_password') {
          mostrarAlerta('La nueva contraseña debe ser diferente a la actual.');
        } else {
          mostrarAlerta('No se pudo cambiar la contraseña. Inténtalo de nuevo más tarde.');
        }
        return;
      }
      setNewPassword('');
      mostrarAlerta('Contraseña actualizada con éxito.');
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      mostrarAlerta('No se pudo cambiar la contraseña. Revisa tu conexión.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // El guardián de app/_layout.tsx redirige al login al detectar el cierre de sesión
  const handleSignOut = async () => {
    const ok = await confirmar('Cerrar sesión', '¿Seguro que quieres salir de la app?', 'Cerrar sesión');
    if (!ok) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      mostrarAlerta('No se pudo cerrar la sesión.');
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={styles.cargando}>Cargando tu perfil…</Text>
        </View>
      </ScreenContainer>
    );
  }

  const direccion = userData?.direccion
    ? `${userData.direccion}${userData.barrio ? ` · ${userData.barrio}` : ''}`
    : null;

  const filas: { icono: string; etiqueta: string; valor: string | null }[] = [
    { icono: 'card-outline', etiqueta: 'Documento', valor: userData?.cedula ?? null },
    { icono: 'call', etiqueta: 'Celular', valor: userData?.celular ?? null },
    { icono: 'map', etiqueta: 'Dirección', valor: direccion },
    { icono: 'calendar-outline', etiqueta: 'Nacimiento', valor: userData?.fecha_nacimiento ? formatFechaLarga(userData.fecha_nacimiento) : null },
  ];

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <ScreenHeader title="Mi perfil" />

        {/* Tarjeta principal */}
        <View style={styles.tarjetaPerfil}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>{getInitials(userData?.full_name)}</Text>
          </View>
          <Text style={styles.nombre}>{userData?.full_name || 'Operario'}</Text>
          <Text style={styles.correo}>{userData?.email}</Text>
        </View>

        {/* Datos */}
        <Text style={styles.seccion}>MIS DATOS</Text>
        <View style={styles.tarjeta}>
          {filas.map((f, i) => (
            <View key={f.etiqueta} style={[styles.fila, i < filas.length - 1 && styles.filaBorde]}>
              <View style={styles.filaIcono}>
                <TabBarIcon name={f.icono} size={16} color={c.primary} />
              </View>
              <Text style={styles.filaEtiqueta}>{f.etiqueta}</Text>
              <Text style={[styles.filaValor, !f.valor && { color: c.textFaint, fontWeight: '400' }]} numberOfLines={2}>
                {f.valor || 'No registrado'}
              </Text>
            </View>
          ))}
        </View>

        {/* Apariencia */}
        <Text style={styles.seccion}>APARIENCIA</Text>
        <View style={[styles.tarjeta, styles.filaApariencia]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filaEtiquetaFuerte}>Tema {esOscuro ? 'oscuro' : 'claro'}</Text>
            <Text style={styles.ayuda}>Se recuerda en este dispositivo.</Text>
          </View>
          <ThemeToggle conTexto />
        </View>

        {/* Seguridad */}
        <Text style={styles.seccion}>SEGURIDAD</Text>
        <View style={styles.tarjeta}>
          <Text style={styles.filaEtiquetaFuerte}>Cambiar contraseña</Text>
          <Text style={[styles.ayuda, { marginBottom: 12 }]}>Mínimo 6 caracteres.</Text>
          <PasswordField
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Nueva contraseña"
            icon="lock-closed-outline"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={updatingPassword || !newPassword}
            style={[styles.botonPrimario, (updatingPassword || !newPassword) && { opacity: 0.5 }]}
            activeOpacity={0.85}
          >
            {updatingPassword
              ? <ActivityIndicator color={c.onPrimary} size="small" />
              : <Text style={styles.botonPrimarioTexto}>Actualizar contraseña</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleSignOut} activeOpacity={0.8} style={styles.botonSalir}>
          <TabBarIcon name="log-out-outline" size={18} color={c.danger} />
          <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cargando: { color: c.textMuted, fontSize: 14, marginTop: 12 },
  tarjetaPerfil: {
    backgroundColor: c.surface, borderRadius: 24, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: c.border, marginTop: 12,
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 4, borderColor: alpha(c.primary, 0.25),
  },
  avatarTexto: { fontSize: 30, fontWeight: '800', color: c.onPrimary },
  nombre: { fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' },
  correo: { fontSize: 14, color: c.textMuted, marginTop: 2, textAlign: 'center' },
  seccion: { color: c.textFaint, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  tarjeta: { backgroundColor: c.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: c.border },
  filaIcono: { width: 32, height: 32, borderRadius: 10, backgroundColor: alpha(c.primary, 0.1), alignItems: 'center', justifyContent: 'center' },
  filaEtiqueta: { color: c.textMuted, fontSize: 14 },
  filaValor: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  filaApariencia: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filaEtiquetaFuerte: { color: c.text, fontSize: 15, fontWeight: '700' },
  ayuda: { color: c.textFaint, fontSize: 12, marginTop: 2 },
  botonPrimario: { backgroundColor: c.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  botonPrimarioTexto: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
  botonSalir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, paddingVertical: 15,
    borderRadius: 16, backgroundColor: alpha(c.danger, 0.08), borderWidth: 1, borderColor: alpha(c.danger, 0.25),
  },
  botonSalirTexto: { color: c.danger, fontSize: 15, fontWeight: '700' },
});
