// app/recuperar.tsx
// Recuperar la contraseña con un código de 6 dígitos enviado al correo (funciona igual en web y en el celular,
// sin enlaces). Requiere SMTP propio en Supabase y la plantilla "Reset Password" con {{ .Token }}.
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { FormField, PasswordField, TextField } from '../components/form/FormField';
import { TabBarIcon } from '../components/TabBarIcon';
import { ThemeToggle } from '../components/ThemeToggle';
import { Turnstile } from '../components/Turnstile';
import { mostrarAlerta } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { alpha, useTheme } from '../lib/theme';
import { TurnstileHandle } from '../lib/turnstile';

const ESPERA_REENVIO_S = 60;

/** "juan.perez@gmail.com" → "j•••@gmail.com" */
const enmascarar = (email: string) => {
  const [usuario, dominio] = email.split('@');
  return `${usuario.slice(0, 1)}•••@${dominio}`;
};

const mensajeAuth = (code?: string) => {
  switch (code) {
    case 'otp_expired': return 'El código venció o no es correcto. Pide uno nuevo.';
    case 'weak_password': return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
    case 'same_password': return 'La nueva contraseña debe ser diferente a la anterior.';
    case 'captcha_failed': return 'No se pudo verificar que no eres un robot. Inténtalo de nuevo.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    default: return 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.';
  }
};

export default function Recuperar() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const turnstile = useRef<TurnstileHandle>(null);

  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [verificado, setVerificado] = useState(false); // el código ya se validó: solo falta guardar la contraseña
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esperaReenvio, setEsperaReenvio] = useState(0);

  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const t = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [esperaReenvio]);

  const enviarCodigo = async (destino?: string) => {
    setError(null);
    setLoading(true);
    try {
      let correo = destino;
      if (!correo) {
        if (!/^\d{3,15}$/.test(cedula)) {
          setError('Escribe tu número de documento (solo números).');
          return;
        }
        const captcha = await turnstile.current?.obtenerToken();
        const { data, error: rpcError } = await supabase.rpc('buscar_acceso', { p_cedula: cedula, p_captcha: captcha ?? null });
        if (rpcError) throw rpcError;
        const resultado = data as { estado: string; email?: string };
        if (resultado.estado === 'limite') { setError('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'); return; }
        if (resultado.estado === 'captcha') { setError('No se pudo verificar que no eres un robot. Inténtalo de nuevo.'); return; }
        if (resultado.estado !== 'ok' || !resultado.email) { setError('No encontramos un operario registrado con ese documento.'); return; }
        correo = resultado.email;
      }

      const captcha = await turnstile.current?.obtenerToken();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(correo, { captchaToken: captcha });
      if (authError) {
        setError(mensajeAuth(authError.code));
        return;
      }
      setEmail(correo);
      setEsperaReenvio(ESPERA_REENVIO_S);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message.includes('anti-bots') ? e.message : mensajeAuth());
    } finally {
      setLoading(false);
    }
  };

  const cambiarContrasena = async () => {
    if (!email) return;
    setError(null);
    if (!verificado && !/^\d{6,10}$/.test(codigo)) {
      setError('Escribe el código que te llegó al correo.');
      return;
    }
    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (!verificado) {
        const captcha = await turnstile.current?.obtenerToken();
        const { error: otpError } = await supabase.auth.verifyOtp({
          email, token: codigo, type: 'recovery', options: { captchaToken: captcha },
        });
        if (otpError) {
          setError(mensajeAuth(otpError.code));
          return;
        }
        setVerificado(true);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(mensajeAuth(updateError.code));
        return;
      }
      mostrarAlerta('Contraseña actualizada', 'Ya puedes usar tu nueva contraseña.');
      router.replace('/(operario)');
    } catch (e) {
      console.error(e);
      setError(mensajeAuth());
    } finally {
      setLoading(false);
    }
  };

  const tarjeta = { backgroundColor: c.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: c.border };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 48, width: '100%', maxWidth: 460, alignSelf: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
            accessibilityLabel="Volver"
            style={{ padding: 8, marginLeft: -8 }}
          >
            <TabBarIcon name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: c.text, fontSize: 22, fontWeight: '800' }}>Recuperar contraseña</Text>
          <ThemeToggle />
        </View>

        <View style={tarjeta}>
          {!email ? (
            <>
              <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>
                Escribe tu número de documento. Te enviaremos un código al correo con el que te registraste.
              </Text>
              <FormField label="Número de documento">
                <TextField
                  value={cedula}
                  onChangeText={(t) => { setCedula(t.replace(/\D/g, '')); setError(null); }}
                  keyboardType="number-pad"
                  placeholder="Ej: 1007744230"
                  icon="card-outline"
                  maxLength={15}
                  returnKeyType="send"
                  onSubmitEditing={() => enviarCodigo()}
                />
              </FormField>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, marginBottom: 18, backgroundColor: alpha(c.success, 0.1) }}>
                <TabBarIcon name="mail" size={18} color={c.success} />
                <Text style={{ color: c.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                  {'Enviamos un código a '}
                  <Text style={{ fontWeight: '700' }}>{enmascarar(email)}</Text>
                  {'. Revisa también la carpeta de spam.'}
                </Text>
              </View>
              {!verificado && (
                <FormField label="Código del correo">
                  <TextField
                    value={codigo}
                    onChangeText={(t) => { setCodigo(t.replace(/\D/g, '')); setError(null); }}
                    keyboardType="number-pad"
                    placeholder="123456"
                    maxLength={10}
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    style={{ letterSpacing: 6, fontSize: 20, fontWeight: '700' }}
                  />
                </FormField>
              )}
              <FormField label="Nueva contraseña" hint="Mínimo 8 caracteres.">
                <PasswordField
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  placeholder="Nueva contraseña"
                  icon="lock-closed-outline"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={cambiarContrasena}
                />
              </FormField>
            </>
          )}

          <Turnstile ref={turnstile} />

          {error && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 14, backgroundColor: alpha(c.danger, 0.1), borderWidth: 1, borderColor: alpha(c.danger, 0.3) }}>
              <TabBarIcon name="alert-circle" size={18} color={c.danger} />
              <Text style={{ color: c.danger, fontSize: 13, flex: 1 }}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => (email ? cambiarContrasena() : enviarCodigo())}
            disabled={loading}
            activeOpacity={0.85}
            style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: loading ? 0.75 : 1 }}
          >
            {loading
              ? <ActivityIndicator color={c.onPrimary} />
              : <Text style={{ color: c.onPrimary, fontSize: 16, fontWeight: '700' }}>{email ? 'Cambiar contraseña' : 'Enviar código'}</Text>}
          </TouchableOpacity>

          {email && !verificado && (
            <TouchableOpacity
              onPress={() => enviarCodigo(email)}
              disabled={loading || esperaReenvio > 0}
              style={{ marginTop: 16, alignSelf: 'center', opacity: esperaReenvio > 0 ? 0.5 : 1 }}
            >
              <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>
                {esperaReenvio > 0 ? `Reenviar código en ${esperaReenvio} s` : 'Reenviar código'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
