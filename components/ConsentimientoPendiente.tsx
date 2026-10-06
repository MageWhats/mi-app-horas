// components/ConsentimientoPendiente.tsx
// Pide la autorización de tratamiento de datos a quien no ha aceptado la versión vigente de la política
// (operarios registrados antes de existir la política o cuando la política cambia).
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { POLITICA_VERSION } from '../constants/empresa';
import { useWorkHours } from '../context/WorkHoursContext';
import { mostrarAlerta } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { TabBarIcon } from './TabBarIcon';

export const ConsentimientoPendiente = () => {
  const router = useRouter();
  const segmentos = useSegments();
  const { colors: c } = useTheme();
  const { user } = useWorkHours();
  const [pendiente, setPendiente] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('politica_version').maybeSingle()
      .then(({ data, error }) => {
        if (error) return; // sin conexión: se vuelve a revisar la próxima vez
        setPendiente(data?.politica_version !== POLITICA_VERSION);
      });
  }, [user]);

  const aceptar = async () => {
    setGuardando(true);
    try {
      const { error } = await supabase.rpc('aceptar_politica', { p_version: POLITICA_VERSION });
      if (error) throw error;
      setPendiente(false);
    } catch (e) {
      console.error(e);
      mostrarAlerta('No se pudo guardar tu autorización', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  // Al abrir la política (otra pantalla) la ventana se oculta para no taparla, y vuelve al regresar
  if (!pendiente || segmentos[0] !== '(operario)') return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: c.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: c.border, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          <TabBarIcon name="shield-checkmark" size={36} color={c.primary} />
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>Tu autorización de datos</Text>
          <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 21, marginTop: 8 }}>
            Para seguir usando la app necesitamos tu autorización para tratar tus datos personales, tu ubicación en el
            momento de marcar y, como su representante legal, los datos de tus hijos menores de edad, según la Ley 1581
            de 2012.
          </Text>
          <TouchableOpacity onPress={() => router.push('/privacidad')} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <Text style={{ color: c.primary, fontSize: 14, fontWeight: '700' }}>Leer la política de privacidad</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={aceptar}
            disabled={guardando}
            style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20, opacity: guardando ? 0.7 : 1 }}
          >
            {guardando ? <ActivityIndicator color={c.onPrimary} /> : <Text style={{ color: c.onPrimary, fontSize: 16, fontWeight: '700' }}>Acepto</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => supabase.auth.signOut()} disabled={guardando} style={{ paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: c.textMuted, fontSize: 14 }}>No acepto, cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
