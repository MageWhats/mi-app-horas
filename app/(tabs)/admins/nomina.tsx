import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Cargo, Entidad, fetchCargosEmpresa, fetchEntidadesColombia } from '../../../lib/apiEntidades';
import { db } from '../../../lib/firebase';

// Constantes Legales Oficiales Colombia 2026
const SMMLV_2026 = 1750905;
const AUX_TRANSPORTE_2026 = 249095;
const MAX_AUX_TOPE = SMMLV_2026 * 2; // $3.501.810
const HORAS_METAS_MENSUALES = 182; // 42h semanales ley 2101

type SubTab = 'VINCULACION' | 'AUDITORIA_HORAS' | 'INCAPACIDADES' | 'SABANA_COSTOS';

interface MarcaTiempo {
  tipo: 'ENTRADA' | 'SALIDA' | 'MANUAL';
  timestamp?: string;
  totalHours?: number;
  isHolidayOrSunday?: boolean;
  latitude?: number;
  longitude?: number;
}

export default function NominaScreen() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('VINCULACION');
  const [loading, setLoading] = useState(false);
  const [filtroCedula, setFiltroCedula] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState('2026-07');

  // Estados de Personal e Historiales
  const [todosLosUsuarios, setTodosLosUsuarios] = useState<any[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<any>(null);
  const [marcasAuditoria, setMarcasAuditoria] = useState<MarcaTiempo[]>([]);

  // Catálogos maestros de Firestore
  const [listaEps, setListaEps] = useState<Entidad[]>([]);
  const [listaPensiones, setListaPensiones] = useState<Entidad[]>([]);
  const [listaCesantias, setListaCesantias] = useState<Entidad[]>([]);
  const [listaArl, setListaArl] = useState<Entidad[]>([]);
  const [listaCajas, setListaCajas] = useState<Entidad[]>([]);
  const [listaCargos, setListaCargos] = useState<Cargo[]>([]);

  // Estados del Formulario de Vinculación (Sub-Tab 1)
  const [cargoSeleccionado, setCargoSeleccionado] = useState('');
  const [rolSeleccionado, setRolSeleccionado] = useState('operario');
  const [epsSeleccionada, setEpsSeleccionada] = useState('');
  const [pensionSeleccionada, setPensionSeleccionada] = useState('');
  const [cesantiasSeleccionada, setCesantiasSeleccionada] = useState('');
  const [arlSeleccionada, setArlSeleccionada] = useState('');
  const [cajaSeleccionada, setCajaSeleccionada] = useState('');

  // Estados del Formulario de Incapacidades (Sub-Tab 3)
  const [fechaInicioIncapacidad, setFechaInicioIncapacidad] = useState('');
  const [diasIncapacidad, setDiasIncapacidad] = useState('0');
  const [tipoIncapacidad, setTipoIncapacidad] = useState('Enfermedad Común');

  // Estados Operacionales para Liquidación (Sub-Tab 4)
  const [isTeletrabajo, setIsTeletrabajo] = useState(false);
  const [prestamosDescuentos, setPrestamosDescuentos] = useState(0);

  // Alertas Multiplataforma para Vercel Web y Móviles
  const emitirAviso = (titulo: string, msg: string) => {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`${titulo}: ${msg}`);
    } else {
      Alert.alert(titulo, msg);
    }
  };

  // Cargar tablas maestras y lista de personal inicial
  const cargarTodaLaData = async () => {
    try {
      setLoading(true);
      const eps = await fetchEntidadesColombia('eps');
      const pen = await fetchEntidadesColombia('pensiones');
      const ces = await fetchEntidadesColombia('cesantias');
      const arl = await fetchEntidadesColombia('arl');
      const caj = await fetchEntidadesColombia('cajas');
      const car = await fetchCargosEmpresa();

      setListaEps(eps);
      setListaPensiones(pen);
      setListaCesantias(ces);
      setListaArl(arl);
      setListaCajas(caj);
      setListaCargos(car);

      const usersSnap = await getDocs(collection(db, 'users'));
      const listaUsers: any[] = [];
      usersSnap.forEach(d => {
        listaUsers.push({ id: d.id, ...d.data() });
      });
      setTodosLosUsuarios(listaUsers);
    } catch (e) {
      console.error(e);
      emitirAviso('Error NoSQL', 'No se pudieron jalar las tablas de Firebase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodaLaData();
  }, [activeSubTab]);

  // Ejecutar Vinculación Contractual y Roles (Sub-Tab 1)
  const handleGuardarVinculacion = async (user: any) => {
    if (!cargoSeleccionado || !epsSeleccionada || !pensionSeleccionada || !cesantiasSeleccionada || !arlSeleccionada || !cajaSeleccionada) {
      emitirAviso('Campos Requeridos', 'Asigne todas las afiliaciones, el cargo operativo y los permisos de acceso.');
      return;
    }
    try {
      setLoading(true);
      const userRef = doc(db, 'users', user.id);
      const cargoData = listaCargos.find(c => c.name === cargoSeleccionado);
      const sueldoAsignado = cargoData ? cargoData.salary : SMMLV_2026;

      await updateDoc(userRef, {
        status: 'ACTIVO',
        role: rolSeleccionado,
        position: cargoSeleccionado.toUpperCase(),
        salary: sueldoAsignado,
        afiliaciones: {
          eps: epsSeleccionada,
          pension: pensionSeleccionada,
          cesantias: cesantiasSeleccionada,
          arl: arlSeleccionada,
          caja: cajaSeleccionada
        }
      });

      emitirAviso('Éxito Contractual', `✓ El operario ${user.fullName} fue activado y sus permisos fueron inyectados.`);
      setUsuarioSeleccionado(null);
      await cargarTodaLaData();
    } catch (e) {
      emitirAviso('Error', 'No se guardaron los datos en Firestore.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar Marcas Horarias Históricas para Auditoría (Sub-Tab 2)
  const handleAuditarHorasOperario = async (user: any) => {
    setUsuarioSeleccionado(user);
    try {
      setLoading(true);
      const docId = `${user.uid}_${mesSeleccionado}`;
      const monthSnap = await getDoc(doc(db, 'work_months', docId));
      if (monthSnap.exists()) {
        const marcasArray: MarcaTiempo[] = Object.values(monthSnap.data().marcas || {});
        setMarcasAuditoria(marcasArray);
      } else {
        setMarcasAuditoria([]);
        emitirAviso('Auditoría', 'No se encontraron registros temporales para este mes.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Guardar Incapacidad Médica Histórica (Sub-Tab 3)
  const handleRegistrarIncapacidad = async () => {
    const totalDias = Number(diasIncapacidad);
    if (!usuarioSeleccionado || !fechaInicioIncapacidad || totalDias <= 0) {
      emitirAviso('Error Novedad', 'Seleccione un operario, la fecha de inicio y digite los días enteros.');
      return;
    }
    try {
      setLoading(true);
      const novedadId = `${usuarioSeleccionado.id}_${Date.now()}`;
      await setDoc(doc(db, 'novedades_salud', novedadId), {
        cedula: usuarioSeleccionado.id,
        fullName: usuarioSeleccionado.fullName,
        fechaInicio: fechaInicioIncapacidad,
        dias: totalDias,
        tipo: tipoIncapacidad,
        mesAsociado: mesSeleccionado
      });

      emitirAviso('Éxito Zeus', `Incapacidad de ${totalDias} días cargada en el libro de novedades.`);
      setFechaInicioIncapacidad('');
      setDiasIncapacidad('0');
      setUsuarioSeleccionado(null);
    } catch (e) {
      emitirAviso('Error', 'Fallo al asentar novedad.');
    } finally {
      setLoading(false);
    }
  };

  // Algoritmo Financiero ERP Sábana de Costos (Sub-Tab 4)
  const calcularNominaConsolidada = (user: any) => {
    const salarioBase = user.salary || SMMLV_2026;
    const calculoSalariosMinimos = salarioBase / SMMLV_2026;
    const valorHoraOrdinaria = salarioBase / HORAS_METAS_MENSUALES;

    let totalRecargosExtras = 0; // Se computaría mapeando las marcas recolectadas
    let auxTransporte = 0;
    if (!isTeletrabajo && salarioBase <= MAX_AUX_TOPE) {
      auxTransporte = AUX_TRANSPORTE_2026;
    }

    const totalDevengado = salarioBase + totalRecargosExtras + auxTransporte;
    const ibc = totalDevengado - auxTransporte;
    const saludTrabajador = ibc * 0.04;
    const pensionTrabajador = ibc * 0.04;
    const netoPagar = totalDevengado - (saludTrabajador + pensionTrabajador + prestamosDescuentos);

    // Provisiones Carga Empresa (Prestaciones y Parafiscales)
    const cesantias = totalDevengado * 0.0833;
    const interesesCesantias = cesantias * 0.12;
    const prima = totalDevengado * 0.0833;
    const vacaciones = (totalDevengado - auxTransporte) * 0.0416;
    const cajaCompensacion = ibc * 0.04;
    const arlRiesgoTres = ibc * 0.02436; // Tarifa fija marítima

    const costoEmpresa = totalDevengado + cesantias + interesesCesantias + prima + vacaciones + cajaCompensacion + arlRiesgoTres;

    return {
      calculoSalariosMinimos, totalRecargosExtras, auxTransporte, totalDevengado,
      saludTrabajador, pensionTrabajador, netoPagar, costoEmpresa
    };
  };

  // Filtrado reactivo de usuarios por buscador
  const usuariosFiltrados = todosLosUsuarios.filter(u => 
    u.id.includes(filtroCedula) || u.fullName?.toLowerCase().includes(filtroCedula.toLowerCase())
  );

  const subTabBtnStyle = (active: boolean) => ({
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: active ? '#3b82f6' : '#1f2937', marginRight: 8, marginBottom: 8
  });

  const selectWrapperStyle = { backgroundColor: '#1f2937', borderRadius: 10, marginBottom: 12, paddingHorizontal: 4 };
  const selectStyle = { backgroundColor: 'transparent', color: '#ffffff', width: '100%', padding: 12, border: 'none', outline: 'none', fontSize: 14 };
  const cardStyle = { backgroundColor: '#111827', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', marginBottom: 16 };
  const inputStyle = { backgroundColor: '#1f2937', color: '#ffffff', padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 12 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#090d16' }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      
      {/* HEADER DE MÓDULO */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>SISTEMA COMPLETO DE NÓMINA ERP</Text>
        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>Mar Profundo — Consola Administrativa Legal</Text>
      </View>

      {/* SUB-BARRA DE NAVEGACIÓN EN CALIENTE (4 PASOS) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 20 }}>
        <TouchableOpacity onPress={() => { setActiveSubTab('VINCULACION'); setUsuarioSeleccionado(null); }} style={subTabBtnStyle(activeSubTab === 'VINCULACION')}><Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>1. Vinculación</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { setActiveSubTab('AUDITORIA_HORAS'); setUsuarioSeleccionado(null); }} style={subTabBtnStyle(activeSubTab === 'AUDITORIA_HORAS')}><Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>2. Auditoría Horas</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { setActiveSubTab('INCAPACIDADES'); setUsuarioSeleccionado(null); }} style={subTabBtnStyle(activeSubTab === 'INCAPACIDADES')}><Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>3. Libro Incapacidades</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { setActiveSubTab('SABANA_COSTOS'); setUsuarioSeleccionado(null); }} style={subTabBtnStyle(activeSubTab === 'SABANA_COSTOS')}><Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>4. Central Costos ERP</Text></TouchableOpacity>
      </ScrollView>

      {/* COMPONENTE BUSCADOR REACTIVO INTEGRADO */}
      <View style={cardStyle}>
        <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>BUSCADOR OPERARIOS (CÉDULA O NOMBRE)</Text>
        <TextInput value={filtroCedula} onChangeText={setFiltroCedula} placeholder="Filtrar personal..." placeholderTextColor="#4b5563" style={inputStyle} />
      </View>

      {loading && <ActivityIndicator size="large" color="#3b82f6" style={{ marginVertical: 20 }} />}

      {/* ====================================================================
          SUB-TAB 1: CONSOLA DE VINCULACIÓN (STATUS == PENDIENTE)
          ==================================================================== */}
      {activeSubTab === 'VINCULACION' && !usuarioSeleccionado && (
        <View>
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>OPERARIOS PENDIENTES POR CONTRATACIÓN</Text>
          {usuariosFiltrados.filter(u => u.status === 'PENDIENTE').map(user => (
            <View key={user.id} style={[cardStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View>
                <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{user.fullName}</Text>
                <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>CC: {user.id} • Cel: {user.datosGenerales?.celular || 'N/A'}</Text>
              </View>
              <TouchableOpacity onPress={() => setUsuarioSeleccionado(user)} style={{ backgroundColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Vincular</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {activeSubTab === 'VINCULACION' && usuarioSeleccionado && (
        <View style={cardStyle}>
          <Text style={{ color: '#3b82f6', fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>TERMINAR REGISTRO: {usuarioSeleccionado.fullName?.toUpperCase()}</Text>
          
          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>ASIGNAR CARGO MAESTRO (SUELDO AUTOMÁTICO)</Text>
          <View style={selectWrapperStyle}>
            <select value={cargoSeleccionado} onChange={(e: any) => setCargoSeleccionado(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: '#111827' }}>-- Selecciona el Cargo --</option>
              {listaCargos.map(c => <option key={c.id} value={c.name} style={{ background: '#111827' }}>{c.name?.toUpperCase()} (${c.salary.toLocaleString()} COP)</option>)}
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>PERMISOS Y ROL EN LA APP (PODERES)</Text>
          <View style={selectWrapperStyle}>
            <select value={rolSeleccionado} onChange={(e: any) => setRolSeleccionado(e.target.value)} style={selectStyle}>
              <option value="operario" style={{ background: '#111827' }}>Operario Común (Solo poncha GPS)</option>
              <option value="admin" style={{ background: '#111827' }}>Administrador (Acceso total ERP)</option>
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>VINCULACIÓN SALUD (EPS)</Text>
          <View style={selectWrapperStyle}>
            <select value={epsSeleccionada} onChange={(e: any) => setEpsSeleccionada(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: '#111827' }}>-- Selecciona la EPS --</option>
              {listaEps.map(e => <option key={e.id} value={e.name} style={{ background: '#111827' }}>{e.name}</option>)}
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>FONDO DE PENSIONES</Text>
          <View style={selectWrapperStyle}>
            <select value={pensionSeleccionada} onChange={(e: any) => setPensionSeleccionada(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: '#111827' }}>-- Selecciona Pensión --</option>
              {listaPensiones.map(p => <option key={p.id} value={p.name} style={{ background: '#111827' }}>{p.name}</option>)}
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>FONDO DE CESANTÍAS</Text>
          <View style={selectWrapperStyle}>
            <select value={cesantiasSeleccionada} onChange={(e: any) => setCesantiasSeleccionada(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: '#111827' }}>-- Selecciona Fondo --</option>
              {listaCesantias.map(c => <option key={c.id} value={c.name} style={{ background: '#111827' }}>{c.name}</option>)}
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>ASEGURADORA DE RIESGOS (ARL)</Text>
          <View style={selectWrapperStyle}>
            <select value={arlSeleccionada} onChange={(e: any) => setArlSeleccionada(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: '#111827' }}>-- Selecciona la ARL --</option>
              {listaArl.map(a => <option key={a.id} value={a.name} style={{ background: '#111827' }}>{a.name}</option>)}
            </select>
          </View>

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>CAJA DE COMPENSACIÓN</Text>
          <View style={selectWrapperStyle}>
            <select value={cajaSeleccionada} onChange={(e: any) => setCajaSeleccionada(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: '#111827' }}>-- Selecciona Caja --</option>
              {listaCajas.map(c => <option key={c.id} value={c.name} style={{ background: '#111827' }}>{c.name}</option>)}
            </select>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity onPress={() => setUsuarioSeleccionado(null)} style={{ flex: 1, backgroundColor: '#374151', padding: 14, borderRadius: 10 }}><Text style={{ color: '#fff', textAlign: 'center' }}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleGuardarVinculacion(usuarioSeleccionado)} style={{ flex: 1, backgroundColor: '#10b981', padding: 14, borderRadius: 10 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>Activar Operario</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* ====================================================================
          SUB-TAB 2: REVISIÓN DE AUDITORÍA HORARIA (DÍA POR DÍA CON GPS)
          ==================================================================== */}
      {activeSubTab === 'AUDITORIA_HORAS' && !usuarioSeleccionado && (
        <View>
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>SELECCIONA OPERARIO PARA AUDITORÍA DIARIA</Text>
          {usuariosFiltrados.filter(u => u.status === 'ACTIVO').map(user => (
            <TouchableOpacity key={user.id} onPress={() => handleAuditarHorasOperario(user)} style={[cardStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View><Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{user.fullName}</Text><Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>CC: {user.id} • Rango: {user.position}</Text></View>
              <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>Auditar Tiempos ➜</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeSubTab === 'AUDITORIA_HORAS' && usuarioSeleccionado && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold' }}>HISTORIAL DE PONCHES: {usuarioSeleccionado.fullName?.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => setUsuarioSeleccionado(null)} style={{ backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>Volver</Text>
            </TouchableOpacity>
          </View>

          {marcasAuditoria.length === 0 ? (
            <Text style={{ color: '#9ca3af', textAlign: 'center', marginVertical: 20 }}>No se encontraron ponches GPS ni registros manuales este mes.</Text>
          ) : (
            marcasAuditoria.map((marca, i) => (
              <View key={i} style={cardStyle}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: marca.tipo === 'MANUAL' ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>MARCA {marca.tipo}</Text>
                  <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{marca.totalHours || 0} Horas</Text>
                </View>
                <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Sincronización ISO: {marca.timestamp}</Text>
                {marca.latitude && (
                  <Text style={{ color: '#3b82f6', fontSize: 11, marginTop: 4, textDecorationLine: 'underline' }}>
                    Coordenadas de Ponche: Lat {marca.latitude} / Lon {marca.longitude} (Santa Marta 🌊)
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* ====================================================================
          SUB-TAB 3: LIBRO DE INCAPACIDADES DE LEY
          ==================================================================== */}
      {activeSubTab === 'INCAPACIDADES' && !usuarioSeleccionado && (
        <View>
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>SELECCIONA EMPLEADO PARA NOVEDAD MÉDICA</Text>
          {usuariosFiltrados.filter(u => u.status === 'ACTIVO').map(user => (
            <TouchableOpacity key={user.id} onPress={() => setUsuarioSeleccionado(user)} style={cardStyle}>
              <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{user.fullName}</Text>
              <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>CC: {user.id} • EPS: {user.afiliaciones?.eps || 'No vinculada'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeSubTab === 'INCAPACIDADES' && usuarioSeleccionado && (
        <View style={cardStyle}>
          <Text style={{ color: '#f59e0b', fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>REGISTRAR INCAPACIDAD: {usuarioSeleccionado.fullName?.toUpperCase()}</Text>
          
          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>FECHA DE INICIO DE LA INCAPACIDAD</Text>
          <TextInput value={fechaInicioIncapacidad} onChangeText={setFechaInicioIncapacidad} style={inputStyle} placeholder="AAAA-MM-DD" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>CANTIDAD DE DÍAS ENTEROS</Text>
          <TextInput value={diasIncapacidad} onChangeText={setDiasIncapacidad} keyboardType="numeric" style={inputStyle} placeholder="Ej: 3" placeholderTextColor="#4b5563" />

          <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>ORIGEN DEL DICTAMEN MÉDICO</Text>
          <View style={selectWrapperStyle}>
            <select value={tipoIncapacidad} onChange={(e: any) => setTipoIncapacidad(e.target.value)} style={selectStyle}>
              <option value="Enfermedad Común" style={{ background: '#111827' }}>Enfermedad Común (Paga 66.67% Empresa)</option>
              <option value="Accidente de Trabajo" style={{ background: '#111827' }}>Accidente de Trabajo - ARL (Paga 100%)</option>
              <option value="Licencia Maternidad/Paternidad" style={{ background: '#111827' }}>Licencia de Maternidad / Paternidad</option>
            </select>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity onPress={() => setUsuarioSeleccionado(null)} style={{ flex: 1, backgroundColor: '#374151', padding: 14, borderRadius: 10 }}><Text style={{ color: '#fff', textAlign: 'center' }}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleRegistrarIncapacidad} style={{ flex: 1, backgroundColor: '#f59e0b', padding: 14, borderRadius: 10 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>Radicar Novedad</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* ====================================================================
          SUB-TAB 4: SÁBANA DE COSTOS Y REPORTE GENERAL ERP
          ==================================================================== */}
      {activeSubTab === 'SABANA_COSTOS' && (
        <View>
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>CONSOLIDADO MENSUAL GENERAL DE COSTOS</Text>
          
          <View style={[cardStyle, { flexDirection: 'row', gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>PRÉSTAMOS / DESCUENTOS FIJOS ($)</Text>
              <TextInput keyboardType="numeric" onChangeText={txt => setPrestamosDescuentos(Number(txt) || 0)} placeholder="Ej: 50000" placeholderTextColor="#4b5563" style={inputStyle} />
            </View>
            <TouchableOpacity onPress={() => setIsTeletrabajo(!isTeletrabajo)} style={{ flex: 1, backgroundColor: isTeletrabajo ? 'rgba(239, 68, 68, 0.1)' : 'transparent', borderWidth: 1, borderColor: '#374151', borderRadius: 12, justifyContent: 'center', alignItems: 'center', height: 44, marginTop: 18, paddingHorizontal: 8 }}>
              <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{isTeletrabajo ? 'TELETRABAJO ACTIVO (SIN AUX)' : 'CÁLCULO NORMAL CON AUX'}</Text>
            </TouchableOpacity>
          </View>

          {usuariosFiltrados.filter(u => u.status === 'ACTIVO').map(user => {
            const dataFinanciera = calcularNominaConsolidada(user);
            return (
              <View key={user.id} style={cardStyle}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#1f2937', paddingBottom: 8, marginBottom: 8 }}>
                  <View>
                    <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 15 }}>{user.fullName?.toUpperCase()}</Text>
                    <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: '600', marginTop: 2 }}>{user.position} • {dataFinanciera.calculoSalariosMinimos.toFixed(2)} SMMLV</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 15 }}>${dataFinanciera.netoPagar.toLocaleString()}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 11 }}>Neto a Pagar</Text>
                  </View>
                </View>

                {/* Sábana de Carga Prestacional */}
                <View style={{ marginTop: 6, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#9ca3af', fontSize: 12 }}>Devengado Total (Básico + Recargos):</Text><Text style={{ color: '#fff', fontSize: 12 }}>${dataFinanciera.totalDevengado.toLocaleString()}</Text></View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#9ca3af', fontSize: 12 }}>Deducciones Salud/Pensión (4% c/u):</Text><Text style={{ color: '#ef4444', fontSize: 12 }}>-${(dataFinanciera.saludTrabajador * 2).toLocaleString()}</Text></View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#1f2937', paddingTop: 4, marginTop: 4 }}><Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 12 }}>Costo Real Total Empresa (Con Provisiones):</Text><Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 12 }}>${dataFinanciera.costoEmpresa.toLocaleString()}</Text></View>
                </View>
              </View>
            );
          })}
        </View>
      )}

    </ScrollView>
  );
}
