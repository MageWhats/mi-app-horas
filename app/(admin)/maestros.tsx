import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  Cargo,
  eliminarCargoEmpresa,
  eliminarEntidadCatalogo,
  Entidad,
  fetchCargosEmpresa,
  fetchEntidadesColombia,
  guardarNuevaEntidad,
  guardarNuevoCargo
} from '../../lib/apiEntidades'; // Ajusta la ruta según tu árbol

type TabActiva = 'ENTIDADES' | 'CARGOS';
type TipoCatalogo = 'eps' | 'pensiones' | 'cesantias' | 'arl' | 'cajas';

export default function ParametrosNominaScreen() {
    const router = useRouter();
    const [tab, setTab] = useState<TabActiva>('ENTIDADES');
    const [loading, setLoading] = useState(false);

    // Estados para el Módulo de Entidades
    const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoCatalogo>('eps');
    const [listaEntidades, setListaEntidades] = useState<Entidad[]>([]);
    const [nombreEntidad, setNombreEntidad] = useState('');
    const [codigoEntidad, setCodigoEntidad] = useState('');

    // Estados para el Módulo de Cargos
    const [listaCargos, setListaCargos] = useState<Cargo[]>([]);
    const [nombreCargo, setNombreCargo] = useState('');
    const [salarioCargo, setSalarioCargo] = useState('');

    // 1. Cargar datos de la pestaña seleccionada
    const cargarDatosCatálogos = async () => {
        try {
            setLoading(true);
            if (tab === 'ENTIDADES') {
                const data = await fetchEntidadesColombia(tipoSeleccionado);
                setListaEntidades(data);
            } else {
                const data = await fetchCargosEmpresa();
                setListaCargos(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatosCatálogos();
    }, [tab, tipoSeleccionado]);

    // 2. Manejo de Alertas Multiplataforma (Web / Móvil)
    const emitirAviso = (msg: string) => {
        if (typeof window !== 'undefined' && window.alert) {
            window.alert(msg);
        } else {
            Alert.alert('Consola Administrativa', msg);
        }
    };

    // 3. Crear Nueva Entidad (EPS, ARL, etc.)
    const handleCrearEntidad = async () => {
        if (!nombreEntidad.trim() || !codigoEntidad.trim()) {
            emitirAviso('Por favor digite el nombre y el código oficial de la entidad.');
            return;
        }
        try {
            setLoading(true);
            await guardarNuevaEntidad(tipoSeleccionado, {
                name: nombreEntidad.trim(),
                code: codigoEntidad.trim().toUpperCase()
            });
            setNombreEntidad('');
            setCodigoEntidad('');
            await cargarDatosCatálogos();
            emitirAviso('Entidad registrada correctamente en la base NoSQL.');
        } catch (e) {
            emitirAviso('Fallo al guardar en Firestore.');
        }
    };

    // 4. Eliminar Entidad
    const handleBorrarEntidad = async (entidad: Entidad) => {
        try {
            setLoading(true);
            await eliminarEntidadCatalogo(tipoSeleccionado, entidad);
            await cargarDatosCatálogos();
            emitirAviso('Entidad removida del sistema.');
        } catch (e) {
            emitirAviso('No se pudo borrar.');
        }
    };

    // 5. Crear Nuevo Cargo con Sueldo amarrado
    const handleCrearCargo = async () => {
        const sueldoNum = Number(salarioCargo.replace(/[^0-9]/g, ''));
        if (!nombreCargo.trim() || !sueldoNum) {
            emitirAviso('Completa el nombre del cargo y un salario básico legal válido.');
            return;
        }
        try {
            setLoading(true);
            await guardarNuevoCargo(nombreCargo.trim(), sueldoNum);
            setNombreCargo('');
            setSalarioCargo('');
            await cargarDatosCatálogos();
            emitirAviso('Perfil de Cargo y Sueldo Base parametrizados con éxito.');
        } catch (e) {
            emitirAviso('Error al crear cargo.');
        }
    };

    // 6. Eliminar Cargo
    const handleBorrarCargo = async (cargo: Cargo) => {
        try {
            setLoading(true);
            await eliminarCargoEmpresa(cargo);
            await cargarDatosCatálogos();
            emitirAviso('Cargo eliminado.');
        } catch (e) {
            emitirAviso('Error.');
        }
    };

    // Estilos fijos para blindar visualmente el despliegue en Vercel web y celulares
    const containerStyle = { flex: 1, backgroundColor: '#090d16', padding: 20 };
    const cardStyle = { backgroundColor: '#111827', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', marginBottom: 20 };
    const inputStyle = { backgroundColor: '#1f2937', color: '#ffffff', padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 12,}as const;
    const tabBtnStyle = (active: boolean) => ({ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: active ? '#3b82f6' : '#1f2937' });

    return (
        <ScrollView style={containerStyle} contentContainerStyle={{ paddingBottom: 40 }}>

            
      {/* HEADER DE MÓDULO ADAPTADO */}
      <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold' }}>CONFIGURACIÓN DE PARÁMETROS</Text>
          <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>Tablas maestras de nómina y contratación</Text>
        </View>

        {/* BOTÓN SOLICITADO: SALIR DEL MÓDULO */}
        <TouchableOpacity
          onPress={() => router.back()} // Como usamos .push() en el index, este hace pop seguro
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 1,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8
          }}
        >
          <Text style={{ color: '#f87171', fontSize: 12, fontWeight: 'bold' }}>✕ Salir Módulo</Text>
        </TouchableOpacity>
      </View>

            {/* BARRA DE PESTAÑAS (TABS GENERALES) */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                <TouchableOpacity onPress={() => setTab('ENTIDADES')} style={tabBtnStyle(tab === 'ENTIDADES')}>
                    <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>Entidades de Ley</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTab('CARGOS')} style={tabBtnStyle(tab === 'CARGOS')}>
                    <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>Cargos y Sueldos</Text>
                </TouchableOpacity>
            </View>

            {/* ==========================================
          MÓDULO A: PARAMETRIZACIÓN DE ENTIDADES
          ========================================== */}
            {tab === 'ENTIDADES' && (
                <View style={{ width: '100%' }}>
                    {/* Selector de sub-catálogo */}
                    <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>SELECCIONA CATEGORÍA A GESTIONAR</Text>
                    <View style={{ backgroundColor: '#1f2937', borderRadius: 10, marginBottom: 16, paddingHorizontal: 4 }}>
                        <select
                            value={tipoSeleccionado}
                            onChange={(e: any) => setTipoSeleccionado(e.target.value)}
                            style={{ backgroundColor: 'transparent', color: '#ffffff', width: '100%', padding: 12, border: 'none', outline: 'none', fontSize: 14 }}
                        >
                            <option value="eps" style={{ background: '#111827' }}>EPS (Entidades Promotoras de Salud)</option>
                            <option value="pensiones" style={{ background: '#111827' }}>Fondos de Pensiones</option>
                            <option value="cesantias" style={{ background: '#111827' }}>Fondos de Cesantías</option>
                            <option value="arl" style={{ background: '#111827' }}>ARL (Administradoras de Riesgos)</option>
                            <option value="cajas" style={{ background: '#111827' }}>Cajas de Compensación Familiar</option>
                        </select>
                    </View>

                    {/* Formulario de Adición */}
                    <View style={cardStyle}>
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>Agregar a catálogo: {tipoSeleccionado?.toUpperCase()}</Text>

                        <TextInput value={nombreEntidad} onChangeText={setNombreEntidad} style={inputStyle} placeholder="Nombre oficial (Ej: EPS Sanitas)" placeholderTextColor="#4b5563" />
                        <TextInput value={codigoEntidad} onChangeText={setCodigoEntidad} style={inputStyle} placeholder="Código Superintendencia (Ej: EPS005)" placeholderTextColor="#4b5563" autoCapitalize="characters" />

                        <TouchableOpacity onPress={handleCrearEntidad} style={{ backgroundColor: '#10b981', padding: 14, borderRadius: 10 }}>
                            <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>Vincular Entidad al Maestro</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Listado de Entidades en DB */}
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>REGISTROS ACTUALES EN FIRESTORE</Text>
                    {loading ? <ActivityIndicator color="#3b82f6" /> : (
                        listaEntidades.map((item) => (
                            <View key={item.id} style={{ backgroundColor: '#111827', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
                                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>Código Oficial: {item.code}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleBorrarEntidad(item)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 8 }}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Remover</Text></TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            )}

            {/* ==========================================
          MÓDULO B: PARAMETRIZACIÓN DE CARGOS Y SUELDOS
          ========================================== */}
            {tab === 'CARGOS' && (
                <View style={{ width: '100%' }}>
                    {/* Formulario de Cargos */}
                    <View style={cardStyle}>
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>ESTRUCTURAR NUEVO CARGO OPERACIONAL</Text>

                        <TextInput value={nombreCargo} onChangeText={setNombreCargo} style={inputStyle} placeholder="Nombre del Puesto (Ej: Supervisor de Pesca)" placeholderTextColor="#4b5563" />
                        <TextInput value={salarioCargo} onChangeText={(txt) => setSalarioCargo(txt.replace(/[^0-9]/g, ''))} keyboardType="numeric" style={inputStyle} placeholder="Salario Básico Mensual en COP ($)" placeholderTextColor="#4b5563"
                        />

                        {/* --- ESTO ES LO QUE TE FALTA EN EL FORMULARIO DE CARGOS --- */}
                        <TouchableOpacity onPress={handleCrearCargo} style={{ backgroundColor: '#3b82f6', padding: 14, borderRadius: 10 }}>
                            <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>Fijar Cargo Financiero</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Listado de Cargos en la Base de Datos */}
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>TABLA RETRIBUTIVA CORPORATIVA</Text>
                    {loading ? <ActivityIndicator color="#3b82f6" /> : (
                        listaCargos.map((item) => (
                            <View key={item.id} style={{ backgroundColor: '#111827', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}> {item.name?.toUpperCase()} </Text>
                                    <Text style={{ color: '#10b981', fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>${item.salary.toLocaleString()} COP / Mes</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleBorrarCargo(item)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 8 }}>
                                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Remover</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}

                </View>
            )} 

        </ScrollView>
    );
} 
