import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore
import { auth, db } from '../lib/firebase';

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
  const [numeroHijos, setNumeroHijos] = useState('0');
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

  const mostrarAlerta = (titulo: string, mensaje: string) => {
    if (Platform.OS === 'web') {
      // Si corre en Vercel o localhost, usa el cuadro nativo del navegador
      window.alert(`${titulo}: ${mensaje}`);
    } else {
      // Si corre en Android o iOS, dispara el modal nativo del celular
      Alert.alert(titulo, mensaje);
    }
  };

  const agregarHijoALista = () => {
    if (!tmpHijoCedula.trim() || !tmpHijoNombres.trim() || !tmpHijoApellidos.trim() || !tmpHijoFechaNacimiento.trim()) {
      mostrarAlerta('Campos incompletos', 'Por favor ingresa todos los datos del hijo.');
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
    setNumeroHijos(String(listaHijos.length + 1));

    // Limpiar temporales
    setTmpHijoCedula(''); setTmpHijoNombres(''); setTmpHijoApellidos(''); setTmpHijoFechaNacimiento('');
    setModalHijoVisible(false);
  };

  const handleFinalizarPreregistro = async () => {
    if (!correo.trim() || !password.trim()) {
      mostrarAlerta('Campos incompletos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    try {
      setLoading(true);

      // 1. Crear el usuario en Firebase Authentication
      // @ts-ignore
      const userCredential = await createUserWithEmailAndPassword(auth, correo.trim(), password);
      const uidAuth = userCredential.user.uid;

      // 2. Estructurar documento maestro NoSQL indexado por CÉDULA
      const nuevoOperarioDocumento = {
        uid: uidAuth,
        cedula: cedula.trim(),
        fullName: `${nombres.trim()} ${apellidos.trim()}`,
        email: correo.trim().toLowerCase(),
        status: 'PENDIENTE', // Marcado como Preregistro incompleto para Nómina
        role: 'operario',
        position: 'OPERARIO / PENDIENTE',
        datosGenerales: {
          tipoId, nombres, apellidos, fechaNacimiento, numeroHijos: Number(numeroHijos),
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

      // 3. Persistir en la colección /users de Firestore
      await setDoc(doc(db, 'users', cedula.trim()), nuevoOperarioDocumento);

      mostrarAlerta('Registro Exitoso', 'Tu preregistro ha sido completado. Ahora puedes iniciar sesión.');
      router.replace('/login');

    } catch (error: any) {
      console.error(error);
      mostrarAlerta('Fallo de Registro', error.message || 'Error de red.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { backgroundColor: '#1f2937', color: '#ffffff', padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 12 };
  const selectWrapperStyle = { backgroundColor: '#1f2937', borderRadius: 10, marginBottom: 12, paddingHorizontal: 4 };
  const selectStyle = { backgroundColor: 'transparent', color: '#ffffff', width: '100%', padding: 12, border: 'none', outline: 'none', fontSize: 14 };

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
          <View style={selectWrapperStyle}>
            <select value={tipoId} onChange={(e: any) => setTipoId(e.target.value)} style={selectStyle}>
              <option value="CC" style={{ background: '#111827' }}>Cédula de Ciudadanía (CC)</option>
              <option value="CE" style={{ background: '#111827' }}>Cédula de Extranjería (CE)</option>
              <option value="PPT" style={{ background: '#111827' }}>Permiso por Protección Temporal (PPT)</option>
              <option value="PAS" style={{ background: '#111827' }}>Pasaporte</option>
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NÚMERO DE IDENTIFICACIÓN (SOLO NÚMEROS)</Text>
          <TextInput keyboardType="numeric" value={cedula} onChangeText={(txt) => setCedula(txt.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="Ej: 100774423" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>LUGAR DE EXPEDICIÓN</Text>
          <TextInput value={lugarExpedicion} onChangeText={setLugarExpedicion} style={inputStyle} placeholder="Municipio de expedición" placeholderTextColor="#4b5563" />

          {/* CAMPO NUEVO: FECHA DE EXPEDICIÓN (Agrégalo justo aquí) */}
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
          <View style={selectWrapperStyle}>
            <select value={genero} onChange={(e: any) => setGenero(e.target.value)} style={selectStyle}>
              <option value="Masculino" style={{ background: '#111827' }}>Masculino</option>
              <option value="Femenino" style={{ background: '#111827' }}>Femenino</option>
              <option value="No Binario" style={{ background: '#111827' }}>No Binario</option>
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>ESTADO CIVIL</Text>
          <View style={selectWrapperStyle}>
            <select value={estadoCivil} onChange={(e: any) => setEstadoCivil(e.target.value)} style={selectStyle}>
              <option value="Soltero/a" style={{ background: '#111827' }}>Soltero/a</option>
              <option value="Casado/a" style={{ background: '#111827' }}>Casado/a</option>
              <option value="Unión Libre" style={{ background: '#111827' }}>Unión Libre</option>
              <option value="Divorciado/a" style={{ background: '#111827' }}>Divorciado/a</option>
              <option value="Viudo/a" style={{ background: '#111827' }}>Viudo/a</option>

            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NIVEL DE ESTUDIOS</Text>
          <View style={selectWrapperStyle}>
            <select value={nivelEstudio} onChange={(e: any) => setNivelEstudio(e.target.value)} style={selectStyle}>
              <option value="Primaria" style={{ background: '#111827' }}>Primaria</option>
              <option value="Bachillerato" style={{ background: '#111827' }}>Bachillerato Completo</option>
              <option value="Técnico" style={{ background: '#111827' }}>Técnico</option>
              <option value="Tecnólogo" style={{ background: '#111827' }}>Tecnólogo</option>
              <option value="Profesional" style={{ background: '#111827' }}>Profesional / Universitario</option>
              <option value="Especialización/Postgrado" style={{ background: '#111827' }}>Especialización / Postgrado</option>
            </select>
          </View>


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



          {/* BOTÓN PARA CAMBIAR AL PASO 2 (Agrégalo aquí) */}
          <TouchableOpacity
            onPress={() => {
              if (!cedula.trim() || !nombres.trim() || !apellidos.trim() || !correo.trim() || !password.trim() || !fechaExpedicion.trim()) {
                mostrarAlerta('Campos incompletos', 'Por favor ingresa todos los datos.');
                return;
              }
              setStep(2);
            }}
            style={{ backgroundColor: '#3b82f6', padding: 14, borderRadius: 10, marginTop: 16 }}
          >
            <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>Siguiente: Núcleo Familiar</Text>
          </TouchableOpacity>
        </View>
      )} {/* <- ESTA LLAVE CIERRA EL CONTEXTO DEL STEP 1 */}


      {/* Pega esto justo antes del condicional de tieneConyuge */}
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

          {tieneConyuge && ( // Aquí continúa tu código de la página 12

            <View style={{ marginTop: 12 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>TIPO DE IDENTIFICACIÓN CÓNYUGE</Text>
              <View style={selectWrapperStyle}>
                <select value={conyugeTipoId} onChange={(e: any) => setConyugeTipoId(e.target.value)} style={selectStyle}>
                  <option value="CC" style={{ background: '#111827' }}>Cédula de Ciudadanía (CC)</option>
                  <option value="CE" style={{ background: '#111827' }}>Cédula de Extranjería (CE)</option>
                  <option value="PPT" style={{ background: '#111827' }}>Permiso por Protección Temporal (PPT)</option>
                </select>
              </View>

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
          </View> {/* <- AGREGA ESTE CIERRE DE VIEW AQUÍ */}
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
          {listaHijos.map((h, idx) => (
            <View key={idx} style={{ backgroundColor: '#1f2937', padding: 12, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: '#ffffff', fontWeight: '600' }}>{h.nombres} {h.apellidos}</Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>{h.tipoId}: {h.id} • Nacido: {h.fechaNacimiento}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                const filtrados = listaHijos.filter(item => item.id !== h.id);
                setListaHijos(filtrados);
                setNumeroHijos(String(filtrados.length));
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
      <Modal visible={modalHijoVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#111827', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#1f2937', maxWidth: 450, width: '100%', alignSelf: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>Formulario de Registro - Hijo</Text>

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>TIPO DE IDENTIFICACIÓN</Text>
            <View style={selectWrapperStyle}>
              <select value={tmpHijoTipoId} onChange={(e: any) => setTmpHijoTipoId(e.target.value)} style={selectStyle}>
                <option value="RC">Registro Civil (RC)</option>
                <option value="TI">Tarjeta de Identidad (TI)</option>
                <option value="CC">Cédula de Ciudadanía (CC)</option>
              </select>
            </View>

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>IDENTIFICACIÓN (SOLO NÚMEROS)</Text>
            <TextInput keyboardType="numeric" value={tmpHijoCedula} onChangeText={(txt) => setTmpHijoCedula(txt.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="Documento hijo" placeholderTextColor="#4b5563" />

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>NOMBRES</Text>
            <TextInput value={tmpHijoNombres} onChangeText={setTmpHijoNombres} style={inputStyle} placeholder="Nombres" placeholderTextColor="#4b5563" />

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>APELLIDOS</Text>
            <TextInput value={tmpHijoApellidos} onChangeText={setTmpHijoApellidos} style={inputStyle} placeholder="Apellidos" placeholderTextColor="#4b5563" />

            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>FECHA DE NACIMIENTO (AAAA-MM-DD)</Text>
            <TextInput value={tmpHijoFechaNacimiento} onChangeText={setTmpHijoFechaNacimiento} style={inputStyle} />

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
