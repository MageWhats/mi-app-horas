// app/register.tsx
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { DateField, formatFechaLarga } from '../components/form/DateField';
import { FormField, PasswordField, TextField } from '../components/form/FormField';
import { SearchSelectField } from '../components/form/SearchSelectField';
import { SelectField } from '../components/SelectField';
import { TabBarIcon } from '../components/TabBarIcon';
import { ThemeToggle } from '../components/ThemeToggle';
import { Turnstile } from '../components/Turnstile';
import {
  CIUDADES, ESTADOS_CIVILES, ESTADOS_CON_CONYUGE, GENEROS, NIVELES_ESTUDIO, TIPOS_ID, TIPOS_ID_HIJO, TIPOS_VIA, tipoIdPorEdad,
} from '../constants/registro';
import { mostrarAlerta } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { alpha, useTheme } from '../lib/theme';
import { TurnstileHandle } from '../lib/turnstile';

interface HijoData {
  tipoId: string;
  id: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
}

const FORM_INICIAL = {
  // Paso 1: cuenta
  tipoId: 'CC', cedula: '', nombres: '', apellidos: '', celular: '', correo: '', password: '',
  // Paso 2: datos personales
  fechaNacimiento: '', lugarNacimiento: '', fechaExpedicion: '', lugarExpedicion: '',
  genero: '', estadoCivil: '', nivelEstudio: '',
  tipoVia: 'Calle', direccionNumero: '', barrio: '', complemento: '',
  // Paso 3: cónyuge
  conyugeTipoId: 'CC', conyugeCedula: '', conyugeNombres: '', conyugeApellidos: '', conyugeFechaNacimiento: '',
};
type FormState = typeof FORM_INICIAL;
type Errores = Partial<Record<keyof FormState, string>>;

const HIJO_INICIAL: HijoData = { tipoId: 'RC', id: '', nombres: '', apellidos: '', fechaNacimiento: '' };

const PASOS = ['Tu cuenta', 'Datos personales', 'Familia'];

const HOY = new Date();
const hace = (anios: number) => new Date(HOY.getFullYear() - anios, HOY.getMonth(), HOY.getDate());
const MIN_FECHA = new Date(1930, 0, 1);

const capitalizar = (texto: string) => texto.replace(/(^|\s)\S/g, (l) => l.toUpperCase());

const traducirErrorAuth = (code?: string) => {
  switch (code) {
    case 'user_already_exists':
    case 'email_exists': return 'Ese correo ya está registrado. Inicia sesión o usa otro correo.';
    case 'email_address_invalid': return 'El correo electrónico no es válido.';
    case 'weak_password': return 'La contraseña es muy débil (mínimo 8 caracteres).';
    case 'captcha_failed': return 'No se pudo verificar que no eres un robot. Inténtalo de nuevo.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    default: return 'No se pudo completar el registro. Revisa tu conexión e inténtalo de nuevo.';
  }
};

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [errores, setErrores] = useState<Errores>({});
  const { colors: c } = useTheme();
  const turnstile = useRef<TurnstileHandle>(null);

  const [hijos, setHijos] = useState<HijoData[]>([]);
  const [hijoModal, setHijoModal] = useState(false);
  const [hijo, setHijo] = useState<HijoData>(HIJO_INICIAL);
  const [hijoError, setHijoError] = useState('');

  const tieneConyuge = ESTADOS_CON_CONYUGE.includes(form.estadoCivil);

  /** Actualiza un campo y limpia su error. */
  const set = <K extends keyof FormState>(campo: K) => (valor: FormState[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  // ─── Validación por paso ───────────────────────────────────────────────────

  const validarPaso = (paso: number): Errores => {
    const e: Errores = {};
    if (paso === 0) {
      if (!/^\d{3,15}$/.test(form.cedula)) e.cedula = 'Escribe tu número de documento (solo números).';
      if (!form.nombres.trim()) e.nombres = 'Escribe tus nombres.';
      if (!form.apellidos.trim()) e.apellidos = 'Escribe tus apellidos.';
      if (!/^3\d{9}$/.test(form.celular)) e.celular = 'El celular debe tener 10 dígitos y empezar por 3.';
      if (!/^\S+@\S+\.\S+$/.test(form.correo.trim())) e.correo = 'Escribe un correo válido.';
      if (form.password.length < 8) e.password = 'Mínimo 8 caracteres.';
    }
    if (paso === 1) {
      if (!form.fechaNacimiento) e.fechaNacimiento = 'Selecciona tu fecha de nacimiento.';
      if (!form.fechaExpedicion) e.fechaExpedicion = 'Selecciona la fecha de expedición del documento.';
      else if (form.fechaNacimiento && form.fechaExpedicion <= form.fechaNacimiento) {
        e.fechaExpedicion = 'Debe ser posterior a tu fecha de nacimiento.';
      }
    }
    return e;
  };

  const siguiente = async () => {
    const e = validarPaso(step);
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    // La cédula se verifica de una vez, para no descubrir al final que ya existe
    if (step === 0) {
      setLoading(true);
      try {
        const captcha = await turnstile.current?.obtenerToken();
        const { data: estado, error } = await supabase.rpc('estado_registro', { p_cedula: form.cedula, p_captcha: captcha ?? null });
        if (error) throw error;
        const mensajes: Record<string, string> = {
          registrada: 'Este documento ya está registrado. Si es tu cuenta, inicia sesión.',
          no_autorizada: 'Este documento no está habilitado para registrarse. Pide a la empresa que lo autorice.',
          invalida: 'Escribe tu número de documento (solo números).',
          captcha: 'No se pudo verificar que no eres un robot. Inténtalo de nuevo.',
          limite: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
        };
        if (estado !== 'disponible') {
          setErrores({ cedula: mensajes[estado as string] ?? 'No pudimos verificar tu documento.' });
          return;
        }
      } catch (error) {
        console.error(error);
        mostrarAlerta('Sin conexión', error instanceof Error && error.message.includes('anti-bots')
          ? error.message
          : 'No pudimos verificar tu documento. Revisa tu conexión e inténtalo de nuevo.');
        return;
      } finally {
        setLoading(false);
      }
    }
    setStep((s) => s + 1);
  };

  // ─── Hijos ─────────────────────────────────────────────────────────────────

  const abrirHijo = () => {
    setHijo(HIJO_INICIAL);
    setHijoError('');
    setHijoModal(true);
  };

  const guardarHijo = () => {
    if (!hijo.nombres.trim() || !hijo.apellidos.trim() || !hijo.fechaNacimiento) {
      setHijoError('Completa nombres, apellidos y fecha de nacimiento.');
      return;
    }
    if (hijo.id && hijos.some((h) => h.id === hijo.id)) {
      setHijoError('Ya agregaste un hijo con ese número de documento.');
      return;
    }
    setHijos((lista) => [...lista, { ...hijo, nombres: hijo.nombres.trim(), apellidos: hijo.apellidos.trim() }]);
    setHijoModal(false);
  };

  // ─── Envío ─────────────────────────────────────────────────────────────────

  const finalizar = async () => {
    for (const paso of [0, 1]) {
      const e = validarPaso(paso);
      if (Object.keys(e).length > 0) {
        setErrores(e);
        setStep(paso);
        return;
      }
    }

    setLoading(true);
    try {
      // El perfil lo crea un trigger en la misma transacción a partir de estos metadatos,
      // así que si algo falla no queda una cuenta a medias.
      const captcha = await turnstile.current?.obtenerToken();
      const { data, error } = await supabase.auth.signUp({
        email: form.correo.trim().toLowerCase(),
        password: form.password,
        options: {
          captchaToken: captcha,
          data: {
            cedula: form.cedula,
            tipo_id: form.tipoId,
            nombres: form.nombres.trim(),
            apellidos: form.apellidos.trim(),
            celular: form.celular,
            fecha_nacimiento: form.fechaNacimiento,
            lugar_nacimiento: form.lugarNacimiento,
            fecha_expedicion: form.fechaExpedicion,
            lugar_expedicion: form.lugarExpedicion,
            genero: form.genero,
            estado_civil: form.estadoCivil,
            nivel_estudio: form.nivelEstudio,
            direccion: form.direccionNumero.trim() ? `${form.tipoVia} ${form.direccionNumero.trim()}` : '',
            barrio: form.barrio.trim(),
            apto_casa: form.complemento.trim(),
            conyuge: tieneConyuge && form.conyugeNombres.trim()
              ? {
                tipoId: form.conyugeTipoId,
                id: form.conyugeCedula,
                nombres: form.conyugeNombres.trim(),
                apellidos: form.conyugeApellidos.trim(),
                fechaNacimiento: form.conyugeFechaNacimiento,
              }
              : null,
            hijos,
          },
        },
      });

      if (error) {
        console.error(error);
        mostrarAlerta('No se pudo registrar', traducirErrorAuth(error.code));
        return;
      }

      if (data.session) {
        // Sin confirmación de correo, signUp deja la sesión abierta; la cerramos para que el operario entre por el login
        await supabase.auth.signOut();
        mostrarAlerta('¡Registro exitoso!', 'Ya puedes iniciar sesión con tu número de documento.');
      } else {
        mostrarAlerta('Revisa tu correo', 'Te enviamos un enlace para confirmar tu cuenta. Después podrás iniciar sesión con tu número de documento.');
      }
      router.replace('/login');
    } catch (error) {
      console.error(error);
      mostrarAlerta('No se pudo registrar', traducirErrorAuth());
    } finally {
      setLoading(false);
    }
  };

  // ─── Interfaz ──────────────────────────────────────────────────────────────

  const cardStyle = { backgroundColor: c.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: c.border };
  const seccion = (texto: string) => (
    <Text style={{ color: c.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 6, marginBottom: 12 }}>{texto}</Text>
  );
  const fila = { flexDirection: 'row' as const, gap: 10 };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingTop: 48, paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' }}
      >
        {/* Encabezado y progreso */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => {
              if (step > 0) setStep(step - 1);
              else if (router.canGoBack()) router.back();
              else router.replace('/login');
            }}
            style={{ padding: 8, marginLeft: -8, marginRight: 4 }}
          >
            <TabBarIcon name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>Crear cuenta</Text>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>Paso {step + 1} de {PASOS.length} · {PASOS[step]}</Text>
          </View>
          <ThemeToggle />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
          {PASOS.map((p, i) => (
            <View key={p} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? c.primary : c.border }} />
          ))}
        </View>

        {/* ── PASO 1: CUENTA ── */}
        {step === 0 && (
          <View style={cardStyle}>
            <FormField label="Tipo de documento">
              <SelectField value={form.tipoId} onChange={set('tipoId')} options={TIPOS_ID} />
            </FormField>
            <FormField label="Número de documento" error={errores.cedula} hint="Con este número iniciarás sesión.">
              <TextField
                value={form.cedula}
                onChangeText={(t) => set('cedula')(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="Ej: 1007744230"
                icon="card-outline"
                maxLength={15}
                hasError={!!errores.cedula}
              />
            </FormField>
            <View style={fila}>
              <View style={{ flex: 1 }}>
                <FormField label="Nombres" error={errores.nombres}>
                  <TextField value={form.nombres} onChangeText={(t) => set('nombres')(capitalizar(t))} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" placeholder="Ej: Juan Carlos" hasError={!!errores.nombres} />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Apellidos" error={errores.apellidos}>
                  <TextField value={form.apellidos} onChangeText={(t) => set('apellidos')(capitalizar(t))} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" placeholder="Ej: Pérez Gómez" hasError={!!errores.apellidos} />
                </FormField>
              </View>
            </View>
            <FormField label="Celular" error={errores.celular}>
              <TextField
                value={form.celular}
                onChangeText={(t) => set('celular')(t.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="Ej: 3001234567"
                icon="call"
                maxLength={10}
                hasError={!!errores.celular}
              />
            </FormField>
            <FormField label="Correo electrónico" error={errores.correo}>
              <TextField
                value={form.correo}
                onChangeText={(t) => set('correo')(t.replace(/\s/g, ''))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="ejemplo@correo.com"
                icon="mail"
                hasError={!!errores.correo}
              />
            </FormField>
            <FormField label="Contraseña" error={errores.password} hint="Mínimo 8 caracteres.">
              <PasswordField
                value={form.password}
                onChangeText={set('password')}
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder="Crea una contraseña"
                icon="lock-closed-outline"
                hasError={!!errores.password}
              />
            </FormField>
          </View>
        )}

        {/* ── PASO 2: DATOS PERSONALES ── */}
        {step === 1 && (
          <View style={cardStyle}>
            {seccion('NACIMIENTO Y DOCUMENTO')}
            <FormField label="Fecha de nacimiento" error={errores.fechaNacimiento}>
              <DateField
                value={form.fechaNacimiento}
                onChange={set('fechaNacimiento')}
                minimumDate={MIN_FECHA}
                maximumDate={hace(14)}
                initialDate={hace(30)}
                hasError={!!errores.fechaNacimiento}
              />
            </FormField>
            <FormField label="Lugar de nacimiento" optional>
              <SearchSelectField value={form.lugarNacimiento} onChange={set('lugarNacimiento')} options={CIUDADES} title="Lugar de nacimiento" placeholder="Busca tu ciudad" />
            </FormField>
            <FormField label="Fecha de expedición del documento" error={errores.fechaExpedicion}>
              <DateField
                value={form.fechaExpedicion}
                onChange={set('fechaExpedicion')}
                minimumDate={form.fechaNacimiento ? new Date(form.fechaNacimiento + 'T00:00:00') : MIN_FECHA}
                maximumDate={HOY}
                initialDate={form.fechaNacimiento ? new Date(new Date(form.fechaNacimiento + 'T00:00:00').getFullYear() + 18, 0, 1) : hace(10)}
                hasError={!!errores.fechaExpedicion}
              />
            </FormField>
            <FormField label="Lugar de expedición" optional>
              <SearchSelectField value={form.lugarExpedicion} onChange={set('lugarExpedicion')} options={CIUDADES} title="Lugar de expedición" placeholder="Busca la ciudad" />
              {!!form.lugarNacimiento && form.lugarExpedicion !== form.lugarNacimiento && (
                <TouchableOpacity onPress={() => set('lugarExpedicion')(form.lugarNacimiento)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>Usar la misma ciudad de nacimiento</Text>
                </TouchableOpacity>
              )}
            </FormField>

            {seccion('INFORMACIÓN PERSONAL')}
            <View style={fila}>
              <View style={{ flex: 1 }}>
                <FormField label="Género" optional>
                  <SelectField value={form.genero} onChange={set('genero')} options={GENEROS} placeholder="Selecciona…" />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Estado civil" optional>
                  <SelectField value={form.estadoCivil} onChange={set('estadoCivil')} options={ESTADOS_CIVILES} placeholder="Selecciona…" />
                </FormField>
              </View>
            </View>
            <FormField label="Nivel de estudios" optional>
              <SelectField value={form.nivelEstudio} onChange={set('nivelEstudio')} options={NIVELES_ESTUDIO} placeholder="Selecciona…" />
            </FormField>

            {seccion('DIRECCIÓN DE RESIDENCIA')}
            <View style={fila}>
              <View style={{ flex: 2 }}>
                <FormField label="Tipo de vía" optional>
                  <SelectField value={form.tipoVia} onChange={set('tipoVia')} options={TIPOS_VIA} />
                </FormField>
              </View>
              <View style={{ flex: 3 }}>
                <FormField label="Número" optional>
                  <TextField value={form.direccionNumero} onChangeText={set('direccionNumero')} placeholder="Ej: 10 # 4-12" autoComplete="street-address" />
                </FormField>
              </View>
            </View>
            <View style={fila}>
              <View style={{ flex: 1 }}>
                <FormField label="Barrio" optional>
                  <TextField value={form.barrio} onChangeText={(t) => set('barrio')(capitalizar(t))} placeholder="Ej: Centro" />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Conjunto / Apto" optional>
                  <TextField value={form.complemento} onChangeText={set('complemento')} placeholder="Ej: Torre 2 Apto 402" />
                </FormField>
              </View>
            </View>
          </View>
        )}

        {/* ── PASO 3: FAMILIA ── */}
        {step === 2 && (
          <View style={cardStyle}>
            {tieneConyuge && (
              <>
                {seccion('CÓNYUGE / COMPAÑERO(A)')}
                <View style={fila}>
                  <View style={{ flex: 1 }}>
                    <FormField label="Nombres" optional>
                      <TextField value={form.conyugeNombres} onChangeText={(t) => set('conyugeNombres')(capitalizar(t))} placeholder="Nombres" />
                    </FormField>
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="Apellidos" optional>
                      <TextField value={form.conyugeApellidos} onChangeText={(t) => set('conyugeApellidos')(capitalizar(t))} placeholder="Apellidos" />
                    </FormField>
                  </View>
                </View>
                <FormField label="Tipo de documento" optional>
                  <SelectField value={form.conyugeTipoId} onChange={set('conyugeTipoId')} options={TIPOS_ID} />
                </FormField>
                <FormField label="Número de documento" optional>
                  <TextField value={form.conyugeCedula} onChangeText={(t) => set('conyugeCedula')(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Solo números" maxLength={15} />
                </FormField>
                <FormField label="Fecha de nacimiento" optional>
                  <DateField value={form.conyugeFechaNacimiento} onChange={set('conyugeFechaNacimiento')} minimumDate={MIN_FECHA} maximumDate={hace(14)} initialDate={hace(30)} />
                </FormField>
              </>
            )}

            {seccion('HIJOS')}
            {hijos.length === 0 && (
              <Text style={{ color: c.textFaint, fontSize: 13, marginBottom: 12 }}>
                Si no tienes hijos, puedes finalizar el registro.
              </Text>
            )}
            {hijos.map((h, idx) => (
              <View key={`${h.id}-${idx}`} style={{ backgroundColor: c.input, padding: 12, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600' }}>{h.nombres} {h.apellidos}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {h.tipoId}{h.id ? `: ${h.id}` : ''} · {formatFechaLarga(h.fechaNacimiento)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setHijos((lista) => lista.filter((_, i) => i !== idx))} style={{ padding: 6 }}>
                  <Text style={{ color: c.danger, fontWeight: '700', fontSize: 13 }}>Quitar</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={abrirHijo}
              style={{ padding: 14, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: c.primary, backgroundColor: alpha(c.primary, 0.08) }}
            >
              <Text style={{ color: c.primary, textAlign: 'center', fontWeight: '700' }}>+ Agregar hijo(a)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Verificación anti-bots (solo si está configurada) */}
        <Turnstile ref={turnstile} />

        {/* Botón principal */}
        <TouchableOpacity
          onPress={step < PASOS.length - 1 ? siguiente : finalizar}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: step < PASOS.length - 1 ? c.primary : c.success,
            padding: 16, borderRadius: 12, marginTop: 20, opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={{ color: c.onPrimary, textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
              {step < PASOS.length - 1 ? 'Continuar' : 'Finalizar registro'}
            </Text>
          )}
        </TouchableOpacity>

        {step === 0 && (
          <TouchableOpacity onPress={() => router.replace('/login')} style={{ marginTop: 18, alignSelf: 'center' }}>
            <Text style={{ color: c.textFaint, fontSize: 13 }}>
              ¿Ya tienes cuenta? <Text style={{ color: c.primary, fontWeight: '700' }}>Inicia sesión</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Hoja para agregar un hijo */}
      <Modal visible={hijoModal} transparent animationType="slide" onRequestClose={() => setHijoModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, maxHeight: '90%' }}
            contentContainerStyle={{ backgroundColor: c.surface, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, width: '100%', maxWidth: 600, alignSelf: 'center' }}
          >
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 16 }}>Agregar hijo(a)</Text>
            <View style={fila}>
              <View style={{ flex: 1 }}>
                <FormField label="Nombres">
                  <TextField value={hijo.nombres} onChangeText={(t) => setHijo((h) => ({ ...h, nombres: capitalizar(t) }))} placeholder="Nombres" />
                </FormField>
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Apellidos">
                  <TextField value={hijo.apellidos} onChangeText={(t) => setHijo((h) => ({ ...h, apellidos: capitalizar(t) }))} placeholder="Apellidos" />
                </FormField>
              </View>
            </View>
            <FormField label="Fecha de nacimiento" hint="El tipo de documento se sugiere según la edad.">
              <DateField
                value={hijo.fechaNacimiento}
                onChange={(fecha) => setHijo((h) => ({ ...h, fechaNacimiento: fecha, tipoId: tipoIdPorEdad(fecha) }))}
                minimumDate={MIN_FECHA}
                maximumDate={HOY}
                initialDate={hace(5)}
              />
            </FormField>
            <FormField label="Tipo de documento">
              <SelectField value={hijo.tipoId} onChange={(v) => setHijo((h) => ({ ...h, tipoId: v }))} options={TIPOS_ID_HIJO} />
            </FormField>
            <FormField label="Número de documento" optional hint="Puedes dejarlo vacío si aún no lo tienes.">
              <TextField value={hijo.id} onChangeText={(t) => setHijo((h) => ({ ...h, id: t.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="Solo números" maxLength={15} />
            </FormField>
            {!!hijoError && <Text style={{ color: c.danger, fontSize: 13, marginBottom: 10 }}>{hijoError}</Text>}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 10 }}>
              <TouchableOpacity onPress={() => setHijoModal(false)} style={{ flex: 1, backgroundColor: c.input, padding: 14, borderRadius: 10 }}>
                <Text style={{ color: c.text, textAlign: 'center' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={guardarHijo} style={{ flex: 1, backgroundColor: c.primary, padding: 14, borderRadius: 10 }}>
                <Text style={{ color: c.onPrimary, textAlign: 'center', fontWeight: '700' }}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
