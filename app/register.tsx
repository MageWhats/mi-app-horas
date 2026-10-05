import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectField } from '../components/SelectField';
import { mostrarAlerta } from '../lib/alert';
import { auth, db } from '../lib/firebase';

const OPCIONES_TIPO_ID = [
  { value: 'CC', label: 'Cédula de Ciudadanía (CC)' },
  { value: 'CE', label: 'Cédula de Extranjería (CE)' },
  { value: 'PPT', label: 'Permiso por Protección Temporal (PPT)' },
  { value: 'PAS', label: 'Pasaporte' },
];
const OPCIONES_TIPO_ID_CONYUGE = OPCIONES_TIPO_ID.filter((o) => o.value !== 'PAS');
const OPCIONES_TIPO_ID_HIJO = [
  { value: 'RC', label: 'Registro Civil (RC)' },
  { value: 'TI', label: 'Tarjeta de Identidad (TI)' },
  { value: 'CC', label: 'Cédula de Ciudadanía (CC)' },
];
const OPCIONES_GENERO = ['Masculino', 'Femenino', 'No Binario'].map((v) => ({ value: v, label: v }));
const OPCIONES_ESTADO_CIVIL = ['Soltero/a', 'Casado/a', 'Unión Libre', 'Divorciado/a', 'Viudo/a'].map((v) => ({ value: v, label: v }));
const OPCIONES_ESTUDIO = [
  { value: 'Primaria', label: 'Primaria' },
  { value: 'Bachillerato', label: 'Bachillerato Completo' },
  { value: 'Técnico', label: 'Técnico' },
  { value: 'Tecnólogo', label: 'Tecnólogo' },
  { value: 'Profesional', label: 'Profesional / Universitario' },
  { value: 'Especialización/Postgrado', label: 'Especialización / Postgrado' },
];

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const esFechaValida = (txt: string) => FECHA_REGEX.test(txt) && !isNaN(new Date(txt + 'T00:00:00').getTime());

// Interfaces estructurales de TypeScript
interface HijoData {
  id: string;
  tipoId: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
}

export default function AdvancedRegister() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);


  // STEP 1: DATOS GENERALES
  const [cedula, setCedula] = useState('');
  const [tipoId, setTipoId] = useState('CC');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState(''); // Formato AAAA-MM-DD
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [urbanizacion, setUrbanizacion] = useState('');
  const [aptoCasa, setAptoCasa] = useState('');
  const [celular, setCelular] = useState('');
  const [genero, setGenero] = useState('Masculino');
  const [estadoCivil, setEstadoCivil] = useState('Soltero/a');
  const [nivelEstudio, setNivelEstudio] = useState('Bachillerato');
  const [correo, setCorreo] = useState('');
  const [lugarNacimiento, setLugarNacimiento] = useState('');
  const [lugarExpedicion, setLugarExpedicion] = useState('');
  const [fechaExpedicion, setFechaExpedicion] = useState(''); // Guardará en formato AAAA-MM-DD
  const [password, setPassword] = useState(''); // Contraseña agregada

  // STEP 2: DATOS FAMILIARES (CÓNYUGE)
  const [tieneConyuge, setTieneConyuge] = useState(false);
  const [conyugeCedula, setConyugeCedula] = useState('');
  const [conyugeTipoId, setConyugeTipoId] = useState('CC');
  const [conyugeNombres, setConyugeNombres] = useState('');
  const [conyugeApellidos, setConyugeApellidos] = useState('');
  const [conyugeFechaNacimiento, setConyugeFechaNacimiento] = useState('');

  // STEP 3: LISTADO DE HIJOS DINÁMICO
  const [listaHijos, setListaHijos] = useState<HijoData[]>([]);
  const [modalHijoVisible, setModalHijoVisible] = useState(false);

  // Estado temporal para el modal de añadir hijo
  const [tmpHijoCedula, setTmpHijoCedula] = useState('');
  const [tmpHijoTipoId, setTmpHijoTipoId] = useState('RC');
  const [tmpHijoNombres, setTmpHijoNombres] = useState('');
  const [tmpHijoApellidos, setTmpHijoApellidos] = useState('');
  const [tmpHijoFechaNacimiento, setTmpHijoFechaNacimiento] = useState('');

  const agregarHijoALista = () => {
    if (!tmpHijoCedula.trim() || !tmpHijoNombres.trim() || !tmpHijoApellidos.trim() || !tmpHijoFechaNacimiento.trim()) {
      mostrarAlerta('Campos incompletos', 'Por favor ingresa todos los datos del hijo.');
      return;
    }
    if (!esFechaValida(tmpHijoFechaNacimiento.trim())) {
      mostrarAlerta('Fecha inválida', 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.');
      return;
    }
    if (listaHijos.some((h) => h.id === tmpHijoCedula.trim())) {
      mostrarAlerta('Hijo duplicado', 'Ya agregaste un hijo con ese número de identificación.');
      return;
    }
    const nuevoHijo: HijoData = {
      id: tmpHijoCedula.trim(),
      tipoId: tmpHijoTipoId,
      nombres: tmpHijoNombres.trim(),
      apellidos: tmpHijoApellidos.trim(),
      fechaNacimiento: tmpHijoFechaNacimiento.trim()
    };
    setListaHijos([...listaHijos, nuevoHijo]);

    // Limpiar temporales
    setTmpHijoCedula(''); setTmpHijoNombres(''); setTmpHijoApellidos(''); setTmpHijoFechaNacimiento('');
    setModalHijoVisible(false);
  };

  const validarPaso1 = (): string | null => {
    if (!cedula.trim() || !nombres.trim() || !apellidos.trim() || !correo.trim() || !password.trim() || !fechaExpedicion.trim()) {
      return 'Por favor ingresa todos los datos obligatorios.';
    }
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) return 'El correo electrónico no es válido.';
    if (password.length < 6) return 'La contraseña debe tener mínimo 6 caracteres.';
    if (!esFechaValida(fechaExpedicion.trim())) return 'La fecha de expedición debe tener el formato AAAA-MM-DD.';
    if (fechaNacimiento.trim() && !esFechaValida(fechaNacimiento.trim())) return 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.';
    return null;
  };

  const traducirErrorAuth = (code?: string) => {
    switch (code) {
      case 'auth/email-already-in-use': return 'Ese correo ya está registrado. Inicia sesión o usa otro correo.';
      case 'auth/invalid-email': return 'El correo electrónico no es válido.';
      case 'auth/weak-password': return 'La contraseña es muy débil (mínimo 6 caracteres).';
      case 'auth/network-request-failed': return 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
      default: return 'No se pudo completar el registro. Inténtalo de nuevo.';
    }
  };

  const handleFinalizarPreregistro = async () => {
    const errorValidacion = validarPaso1();
    if (errorValidacion) {
      mostrarAlerta('Revisa tus datos', errorValidacion);
      setStep(1);
      return;
    }

    const cedulaLimpia = cedula.trim();
    try {
      setLoading(true);

      // 1. La cédula es la llave del documento: si ya existe, no se puede sobrescribir otro perfil
      const existente = await getDoc(doc(db, 'users', cedulaLimpia));
      if (existente.exists()) {
        mostrarAlerta('Cédula ya registrada', 'Ya existe un operario con este número de identificación. Si es tu cuenta, inicia sesión.');
        return;
      }

      // 2. Crear el usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, correo.trim(), password);

      // 3. Documento maestro indexado por CÉDULA
      const nuevoOperarioDocumento = {
        uid: userCredential.user.uid,
        cedula: cedulaLimpia,
        fullName: `${nombres.trim()} ${apellidos.trim()}`,
        email: correo.trim().toLowerCase(),
        status: 'PENDIENTE', // Preregistro incompleto para Nómina
        role: 'operario',
        position: 'OPERARIO / PENDIENTE',
        datosGenerales: {
          tipoId, nombres: nombres.trim(), apellidos: apellidos.trim(), fechaNacimiento, numeroHijos: listaHijos.length,
          direccion, barrio, urbanizacion, aptoCasa, celular, genero,
          estadoCivil, nivelEstudio, lugarNacimiento, lugarExpedicion, fechaExpedicion
        },
        conyuge: {
          tieneConyuge,
          id: tieneConyuge ? conyugeCedula.trim() : null,
          tipoId: tieneConyuge ? conyugeTipoId : null,
          nombres: tieneConyuge ? conyugeNombres.trim() : null,
          apellidos: tieneConyuge ? conyugeApellidos.trim() : null,
          fechaNacimiento: tieneConyuge ? conyugeFechaNacimiento : null,
        },
        hijos: listaHijos
      };

      try {
        await setDoc(doc(db, 'users', cedulaLimpia), nuevoOperarioDocumento);
      } catch (error) {
        // Sin perfil en Firestore la cuenta no sirve para iniciar sesión: la deshacemos para permitir reintentar
        await deleteUser(userCredential.user).catch(() => undefined);
        throw error;
      }

      // createUserWithEmailAndPassword deja la sesión abierta; la cerramos para que el operario entre por el login
      await signOut(auth);
      mostrarAlerta('Registro Exitoso', 'Tu preregistro ha sido completado. Ahora puedes iniciar sesión.');
      router.replace('/login');

    } catch (error: any) {
      console.error(error);
      mostrarAlerta('Fallo de Registro', traducirErrorAuth(error?.code));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { backgroundColor: '#1f2937', color: '#ffffff', padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 12 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#090d16' }} contentContainerStyle={{ padding: 20, maxWidth: 600, width: '100%', alignSelf: 'center' }}>

      {/* Barra de Progreso Superior */}
      <View style={{ marginBottom: 24, alignItems: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>ASISTENTE DE PREREGISTRO</Text>
        <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '600', marginTop: 4 }}>Paso {step} de 3</Text>
      </View>

      {/* ==========================================
          PASO 1: DATOS GENERALES Y DEMOGRÁFICOS
          ========================================== */}
      {step === 1 && (
        <View style={{ backgroundColor: '#111827', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937' }}>
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 14 }}>1. DATOS GENERALES DEL EMPLEADO</Text>

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>TIPO DE IDENTIFICACIÓN</Text>
          <SelectField value={tipoId} onChange={setTipoId} options={OPCIONES_TIPO_ID} />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NÚMERO DE IDENTIFICACIÓN (SOLO NÚMEROS)</Text>
          <TextInput keyboardType="numeric" value={cedula} onChangeText={(txt) => setCedula(txt.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="Ej: 100774423" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>LUGAR DE EXPEDICIÓN</Text>
          <TextInput value={lugarExpedicion} onChangeText={setLugarExpedicion} style={inputStyle} placeholder="Municipio de expedición" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>FECHA DE EXPEDICIÓN DE LA IDENTIFICACIÓN (AAAA-MM-DD)</Text>
          <TextInput
            value={fechaExpedicion}
            onChangeText={setFechaExpedicion}
            style={inputStyle}
            placeholder="Ej: 2015-04-22"
            placeholderTextColor="#4b5563"
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NOMBRES</Text><TextInput value={nombres} onChangeText={setNombres} style={inputStyle} /></View>
            <View style={{ flex: 1 }}><Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>APELLIDOS</Text><TextInput value={apellidos} onChangeText={setApellidos} style={inputStyle} /></View>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>FECHA DE NACIMIENTO (AAAA-MM-DD)</Text>
          <TextInput value={fechaNacimiento} onChangeText={setFechaNacimiento} style={inputStyle} placeholder="Ej: 1995-08-14" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>LUGAR DE NACIMIENTO</Text>
          <TextInput value={lugarNacimiento} onChangeText={setLugarNacimiento} style={inputStyle} placeholder="Ciudad / Municipio" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>GÉNERO</Text>
          <SelectField value={genero} onChange={setGenero} options={OPCIONES_GENERO} />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>ESTADO CIVIL</Text>
          <SelectField value={estadoCivil} onChange={setEstadoCivil} options={OPCIONES_ESTADO_CIVIL} />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NIVEL DE ESTUDIOS</Text>
          <SelectField value={nivelEstudio} onChange={setNivelEstudio} options={OPCIONES_ESTUDIO} />


          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NÚMERO DE CELULAR DE CONTACTO</Text>
          <TextInput keyboardType="numeric" value={celular} onChangeText={(txt) => setCelular(txt.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="Ej: 3001234567" placeholderTextColor="#4b5563" />


          {/* Dirección Estructurada */}
          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>DIRECCIÓN RESIDENCIAL PRINCIPAL</Text>
          <TextInput value={direccion} onChangeText={setDireccion} style={inputStyle} placeholder="Ej: Calle 10 # 4-12" placeholderTextColor="#4b5563" />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>BARRIO</Text>
              <TextInput value={barrio} onChangeText={setBarrio} style={inputStyle} placeholder="Barrio" placeholderTextColor="#4b5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>URBANIZACIÓN / EDIFICIO</Text>
              <TextInput value={urbanizacion} onChangeText={setUrbanizacion} style={inputStyle} placeholder="Conjunto / Edificio" placeholderTextColor="#4b5563" />
            </View>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>APARTAMENTO / CASA / LOCAL</Text>
          <TextInput value={aptoCasa} onChangeText={setAptoCasa} style={inputStyle} placeholder="Ej: Apto 402 / Casa 3" placeholderTextColor="#4b5563" />

          {/* Credenciales de Acceso solicitadas */}
          <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: 'bold', marginTop: 14, marginBottom: 8 }}>CREACIÓN DE CREDENCIALES DE ACCESO</Text>

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>CORREO ELECTRÓNICO</Text>
          <TextInput value={correo} onChangeText={setCorreo} keyboardType="email-address" autoCapitalize="none" style={inputStyle} placeholder="ejemplo@correo.com" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>CONTRASEÑA DE ACCESO (MÍNIMO 6 CARACTERES)</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry style={inputStyle} placeholder="••••••••" placeholderTextColor="#4b5563" />



          <TouchableOpacity
            onPress={() => {
              const errorValidacion = validarPaso1();
              if (errorValidacion) {
                mostrarAlerta('Revisa tus datos', errorValidacion);
                return;
              }
              setStep(2);
            }}
            style={{ backgroundColor: '#3b82f6', padding: 14, borderRadius: 10, marginTop: 16 }}
          >
            <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>Siguiente: Núcleo Familiar</Text>
          </TouchableOpacity>
        </View>
      )}


      {step === 2 && (
        <View style={{ backgroundColor: '#111827', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937' }}>
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 14 }}>2. INFORMACIÓN DEL CÓNYUGE / COMPAÑERO/A</Text>

          <TouchableOpacity
            onPress={() => setTieneConyuge(!tieneConyuge)}
            style={{
              backgroundColor: tieneConyuge ? 'rgba(16, 185, 129, 0.12)' : 'rgba(55, 65, 81, 0.4)',
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tieneConyuge ? '#10b981' : '#374151',
              marginBottom: 20
            }}
          >
            <Text style={{ color: tieneConyuge ? '#10b981' : '#d1d5db', textAlign: 'center', fontWeight: 'bold' }}>
              {tieneConyuge ? '✓ POSEO CÓNYUGE ACTUAL (CAMPOS ACTIVOS)' : '+ CLIC AQUÍ SI TIENES CÓNYUGE / COMPAÑERO'}
            </Text>
          </TouchableOpacity>

          {tieneConyuge && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>TIPO DE IDENTIFICACIÓN CÓNYUGE</Text>
              <SelectField value={conyugeTipoId} onChange={setConyugeTipoId} options={OPCIONES_TIPO_ID_CONYUGE} />

              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NÚMERO DE IDENTIFICACIÓN CÓNYUGE</Text>
              <TextInput keyboardType="numeric" value={conyugeCedula} onChangeText={(txt) => setConyugeCedula(txt.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="Cédula cónyuge" placeholderTextColor="#4b5563" />

              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NOMBRES CÓNYUGE</Text>
              <TextInput value={conyugeNombres} onChangeText={setConyugeNombres} style={inputStyle} placeholder="Nombres completos" placeholderTextColor="#4b5563" />

              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>APELLIDOS CÓNYUGE</Text>
              <TextInput value={conyugeApellidos} onChangeText={setConyugeApellidos} style={inputStyle} placeholder="Apellidos completos" placeholderTextColor="#4b5563" />

              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>FECHA DE NACIMIENTO CÓNYUGE (AAAA-MM-DD)</Text>
              <TextInput value={conyugeFechaNacimiento} onChangeText={setConyugeFechaNacimiento} style={inputStyle} placeholder="Ej: 1996-05-20" placeholderTextColor="#4b5563" />
            </View>
          )}

          {/* BOTONES DE CONTROL DE FLUJO DEL PASO 2 */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity onPress={() => setStep(1)} style={{ flex: 1, backgroundColor: '#374151', padding: 14, borderRadius: 10 }}>
              <Text style={{ color: '#ffffff', textAlign: 'center' }}>Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(3)} style={{ flex: 1, backgroundColor: '#3b82f6', padding: 14, borderRadius: 10 }}>
              <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>Siguiente: Hijos</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ==========================================
          PASO 3: REGISTRO DINÁMICO DE HIJOS
          ========================================== */}
      {step === 3 && (
        <View style={{ backgroundColor: '#111827', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937' }}>
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>3. REGISTRO DE HIJOS DEL TRABAJADOR</Text>
          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 16 }}>Hijos agregados: {listaHijos.length}</Text>

          {/* Listado Reactivo de Hijos en cola */}
          {listaHijos.map((h) => (
            <View key={h.id} style={{ backgroundColor: '#1f2937', padding: 12, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: '#ffffff', fontWeight: '600' }}>{h.nombres} {h.apellidos}</Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>{h.tipoId}: {h.id} • Nacido: {h.fechaNacimiento}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                const filtrados = listaHijos.filter(item => item.id !== h.id);
                setListaHijos(filtrados);
              }}><Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 12 }}>Quitar</Text></TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={() => setModalHijoVisible(true)} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 14, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#3b82f6', marginBottom: 24 }}>
            <Text style={{ color: '#3b82f6', textAlign: 'center', fontWeight: 'bold' }}>+ AGREGAR NUEVO HIJO</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setStep(2)} style={{ flex: 1, backgroundColor: '#374151', padding: 14, borderRadius: 10 }}><Text style={{ color: '#ffffff', textAlign: 'center' }}>Atrás</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleFinalizarPreregistro} disabled={loading} style={{ flex: 1, backgroundColor: '#10b981', padding: 14, borderRadius: 10 }}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>Finalizar Preregistro</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ==========================================
          MODAL FLOTANTE INTERACTIVO PARA HIJO
          ========================================== */}
      <Modal visible={modalHijoVisible} transparent={true} animationType="fade" onRequestClose={() => setModalHijoVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#111827', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#1f2937', maxWidth: 450, width: '100%', alignSelf: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>Formulario de Registro - Hijo</Text>

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>TIPO DE IDENTIFICACIÓN</Text>
            <SelectField value={tmpHijoTipoId} onChange={setTmpHijoTipoId} options={OPCIONES_TIPO_ID_HIJO} />

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>IDENTIFICACIÓN (SOLO NÚMEROS)</Text>
            <TextInput keyboardType="numeric" value={tmpHijoCedula} onChangeText={(txt) => setTmpHijoCedula(txt.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="Documento hijo" placeholderTextColor="#4b5563" />

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>NOMBRES</Text>
            <TextInput value={tmpHijoNombres} onChangeText={setTmpHijoNombres} style={inputStyle} placeholder="Nombres" placeholderTextColor="#4b5563" />

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>APELLIDOS</Text>
            <TextInput value={tmpHijoApellidos} onChangeText={setTmpHijoApellidos} style={inputStyle} placeholder="Apellidos" placeholderTextColor="#4b5563" />

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>FECHA DE NACIMIENTO (AAAA-MM-DD)</Text>
            <TextInput value={tmpHijoFechaNacimiento} onChangeText={setTmpHijoFechaNacimiento} style={inputStyle} placeholder="Ej: 2015-03-10" placeholderTextColor="#4b5563" />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity onPress={() => setModalHijoVisible(false)} style={{ flex: 1, backgroundColor: '#374151', padding: 12, borderRadius: 10 }}><Text style={{ color: '#ffffff', textAlign: 'center' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={agregarHijoALista} style={{ flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 10 }}><Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>Vincular Hijo</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
