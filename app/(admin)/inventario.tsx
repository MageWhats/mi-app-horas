import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Tipado estricto para los Sub-Tabs de un SaaS ERP Universal
type SubTabInventario = 'STOCK_BODEGAS' | 'CUSTODIA_DOTACION' | 'TRASLADOS' | 'KARDEX_REPORTE';

export default function InventarioScreen() {
    const router = useRouter();
    const [activeSubTab, setActiveSubTab] = useState<SubTabInventario>('STOCK_BODEGAS');
    const [filtroArticulo, setFiltroArticulo] = useState('');
    const [bodegaSeleccionada, setBodegaSeleccionada] = useState('BODEGA_CENTRAL');
    const [modalVisible, setModalVisible] = useState(false);
    const [operarioBusqueda, setOperarioBusqueda] = useState('');
    const [operarioSeleccionado, setOperarioSeleccionado] = useState<any>(null);
    const [articuloSeleccionadoForm, setArticuloSeleccionadoForm] = useState('');
    const [tipoEntrega, setTipoEntrega] = useState<'DOTACION' | 'HERRAMIENTA'>('DOTACION');
    const [tallaPrenda, setTallaPrenda] = useState('');
    const [serieHerramienta, setSerieHerramienta] = useState('');

    // 📝 DATOS SEMILLA PARA PRUEBAS VISUALES (Simulando un esquema Multi-tenant de Colombia)
    const bodegasMock = [
        { id: 'BODEGA_CENTRAL', name: 'Almacén Central - Principal' },
        { id: 'OBRA_CALLE_100', name: 'Frente de Obra - Calle 100 (Bogotá)' },
        { id: 'PROYECTO_SAMARIA', name: 'Proyecto Satélite - Santa Marta' },
    ];

    const articulosMock = [
        { id: '1', name: 'Taladro Percutor Dewalt 20V', sku: 'HERR-001', type: 'ACTIVO', stock: 14, min: 5, unit: 'Und' },
        { id: '2', name: 'Casco de Seguridad de Alta Resistencia (Blanco)', sku: 'EPP-042', type: 'CONSUMIBLE', stock: 120, min: 30, unit: 'Und' },
        { id: '3', name: 'Dotación Camisa Tipo Oxford M/L - Talla M', sku: 'DOT-2026M', type: 'DOTACION', stock: 4, min: 20, unit: 'Und' }, // Datos adaptados al año 2026
        { id: '4', name: 'Cable de Cobre Concéntrico n.° 8 AWG', sku: 'MAT-108', type: 'CONSUMIBLE', stock: 450, min: 100, unit: 'Metros' },
    ];

    // Mock data de operarios para la prueba visual
    const operariosMock = [
        { id: '10823456', fullName: 'Carlos Mendoza', cargo: 'Operario de Maquinaria' },
        { id: '10456789', fullName: 'Juan Pérez', cargo: 'Ayudante de Campo' },
    ];

    // 🎨 OBJETOS DE ESTILOS ADAPTADOS DE TU UI OSCURA DE NÓMINA
    const subTabBtnStyle = (active: boolean) => ({
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: active ? '#00b4d8' : '#1e293b', // Color cian destacado de tus pestañas
        marginRight: 8,
        marginBottom: 8,
    });

    const cardStyle = { backgroundColor: '#111827', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', marginBottom: 14 };
    const inputStyle = { backgroundColor: '#1f2937', color: '#ffffff', padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 12 };
    const badgeStyle = (type: string) => ({
        backgroundColor: type === 'ACTIVO' ? 'rgba(59, 130, 246, 0.15)' : type === 'DOTACION' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 10, fontWeight: 'bold' as const,
        color: type === 'ACTIVO' ? '#60a5fa' : type === 'DOTACION' ? '#c084fc' : '#34d399'
    });

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#090d16' }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

            {/* 🏢 HEADER DEL MÓDULO UNIVERSAL CON BOTÓN DE SALIDA */}
            <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>CONTROL DE INVENTARIO ERP</Text>
                    <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>Módulo Maestro Multi-Bodega y Dotaciones</Text>
                </View>

                <TouchableOpacity
                    onPress={() => router.back()} // Vuelve de forma nativa al panel gerencial
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
                >
                    <Text style={{ color: '#f87171', fontSize: 12, fontWeight: 'bold' }}>✕ Salir</Text>
                </TouchableOpacity>
            </View>

            {/* 🏢 CONTROLLER SELECTOR DE BODEGAS (SaaS Multi-proyecto) */}
            <View style={[cardStyle, { marginBottom: 16 }]}>
                <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>UBICACIÓN O FRENTE DE TRABAJO SELECCIONADO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                    {bodegasMock.map((b) => (
                        <TouchableOpacity
                            key={b.id}
                            onPress={() => setBodegaSeleccionada(b.id)}
                            style={{ backgroundColor: bodegaSeleccionada === b.id ? 'rgba(0, 180, 216, 0.1)' : 'transparent', borderColor: bodegaSeleccionada === b.id ? '#00b4d8' : '#374151', borderWidth: 1, padding: 10, borderRadius: 8, marginRight: 8 }}
                        >
                            <Text style={{ color: bodegaSeleccionada === b.id ? '#00b4d8' : '#9ca3af', fontSize: 12, fontWeight: '600' }}>{b.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* 🔀 SUB-BARRA DE NAVEGACIÓN EN CALIENTE (4 PILARES SAAS) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setActiveSubTab('STOCK_BODEGAS')} style={subTabBtnStyle(activeSubTab === 'STOCK_BODEGAS')}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>1. Catálogo & Stock</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveSubTab('CUSTODIA_DOTACION')} style={subTabBtnStyle(activeSubTab === 'CUSTODIA_DOTACION')}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>2. Control Custodia & Dotación</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveSubTab('TRASLADOS')} style={subTabBtnStyle(activeSubTab === 'TRASLADOS')}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>3. Traslados Internos</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveSubTab('KARDEX_REPORTE')} style={subTabBtnStyle(activeSubTab === 'KARDEX_REPORTE')}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>4. Historial Kardex</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* 🔍 COMPONENTE BUSCADOR INTEGRADO */}
            <View style={[cardStyle, { padding: 12, marginBottom: 16 }]}>
                <TextInput
                    value={filtroArticulo}
                    onChangeText={setFiltroArticulo}
                    placeholder="Buscar por SKU, Nombre de artículo o Categoría..."
                    placeholderTextColor="#4b5563"
                    style={[inputStyle, { marginBottom: 0 }]}
                />
            </View>

            {/* ====================================================================
          SUB-TAB 1: ENTRADAS, SALIDAS Y CATÁLOGO GENERAL 
          ==================================================================== */}
            {activeSubTab === 'STOCK_BODEGAS' && (
                <View>
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>EXISTENCIAS EN ESTA BODEGA</Text>
                    {articulosMock.map((art) => {
                        const esCritico = art.stock <= art.min;
                        return (
                            <View key={art.id} style={cardStyle}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={badgeStyle(art.type)}>{art.type}</Text>
                                            <Text style={{ color: '#6b7280', fontSize: 11 }}>SKU: {art.sku}</Text>
                                        </View>
                                        <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 15 }}>{art.name}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ color: esCritico ? '#f87171' : '#10b981', fontWeight: 'bold', fontSize: 18 }}>{art.stock}</Text>
                                        <Text style={{ color: '#6b7280', fontSize: 11 }}>{art.unit}</Text>
                                    </View>
                                </View>

                                {/* Indicador de stock mínimo regulatorio */}
                                <View style={{ borderTopWidth: 1, borderColor: '#1f2937', marginTop: 10, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#6b7280', fontSize: 11 }}>Mínimo requerido: {art.min} {art.unit}</Text>
                                    {esCritico && <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>⚠️ Alerta: Reposición Urgente</Text>}
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* ====================================================================
          SUB-TAB 2: CUSTODIA DE HERRAMIENTAS Y LEGISLACIÓN DE DOTACIONES COLOMBIA
          ==================================================================== */}
            {activeSubTab === 'CUSTODIA_DOTACION' && (
                <View>
                    <View style={[cardStyle, { borderColor: 'rgba(168, 85, 247, 0.4)' }]}>
                        <Text style={{ color: '#c084fc', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>REGISTRO LEGAL DE DOTACIÓN O HERRAMIENTAS</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>Asigna responsabilidades de custodia a operarios mediante Cédula de Ciudadanía.</Text>

                        {/* BOTÓN CONECTADO AL ESTADO ACCIONADOR */}
                        <TouchableOpacity
                            onPress={() => setModalVisible(true)}
                            style={{ backgroundColor: '#a855f7', padding: 14, borderRadius: 10, alignItems: 'center' }}
                        >
                            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>+ Despachar a Responsable de Campo</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Historial rápido decorativo debajo de la tarjeta */}
                    <Text style={{ color: '#6b7280', fontSize: 13, marginBottom: 8, fontWeight: '600', marginTop: 10 }}>CUSTODIAS ACTIVAS EN CAMPO</Text>
                    <View style={cardStyle}>
                        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Carlos Mendoza (CC: 10823456)</Text>
                        <Text style={{ color: '#a855f7', fontSize: 12, marginTop: 2 }}>🔧 Taladro Dewalt (Serie: DW-9921) • Entrega: Activa</Text>
                    </View>
                </View>
            )}

            {/* ====================================================================
          SUB-TAB 3: TRASLADOS ENTRE PROYECTOS / REMISIONES
          ==================================================================== */}
            {activeSubTab === 'TRASLADOS' && (
                <View style={cardStyle}>
                    <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 4 }}>NUEVA REMISIÓN INTERNA DE MATERIALES</Text>
                    <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Transfiere inventario entre bodegas sin generar descuadres contables.</Text>

                    <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>BODEGA DE ORIGEN</Text>
                    <TextInput value="Almacén Central - Principal" editable={false} style={[inputStyle, { opacity: 0.6 }]} />

                    <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>BODEGA DE DESTINO (PROYECTO RECEPTOR)</Text>
                    <TextInput placeholder="Ej: Obra Calle 100" placeholderTextColor="#4b5563" style={inputStyle} />

                    <TouchableOpacity style={{ backgroundColor: '#00b4d8', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 }}>
                        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Emitir Orden de Traslado</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ====================================================================
          SUB-TAB 4: REPORTE GENERAL DE KARDEX FINANCIERO (NIIF)
          ==================================================================== */}
            {activeSubTab === 'KARDEX_REPORTE' && (
                <View>
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>HISTORIAL DE MOVIMIENTOS RECIENTES</Text>

                    <View style={cardStyle}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 12 }}>📥 ENTRADA POR COMPRA</Text>
                            <Text style={{ color: '#6b7280', fontSize: 11 }}>Hace 20 min</Text>
                        </View>
                        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>+50 Cascos de Seguridad (Blanco)</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Destino: Almacén Central • Responsable: Administrador</Text>
                    </View>

                    <View style={cardStyle}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: '#f87171', fontWeight: 'bold', fontSize: 12 }}>📤 SALIDA / DESPACHO</Text>
                            <Text style={{ color: '#6b7280', fontSize: 11 }}>Ayer</Text>
                        </View>
                        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>-1 Taladro Percutor Dewalt 20V</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Asignado a: Carlos Mendoza (CC: 1.082.XXX) • Bodega: Obra Calle 100</Text>
                    </View>
                </View>
            )}
            {/* ====================================================================
          MODAL INTERACTIVO DE DESPACHO (SaaS Multi-Tenant Colombia)
          ==================================================================== */}
            {modalVisible && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 8, 16, 0.95)', padding: 20, paddingTop: 40, zIndex: 999 }}>

                    {/* Header del Modal */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>NUEVO DESPACHO DE ALMACÉN</Text>
                        <TouchableOpacity
                            onPress={() => { setModalVisible(false); setOperarioSeleccionado(null); }}
                            style={{ backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                        >
                            <Text style={{ color: '#fff', fontSize: 12 }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>

                    {/* PASO A: BUSCADOR REACTIVO DE OPERARIOS */}
                    {!operarioSeleccionado ? (
                        <View style={cardStyle}>
                            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>1. BUSCAR OPERARIO DESTINATARIO (CÉDULA O NOMBRE)</Text>
                            <TextInput
                                value={operarioBusqueda}
                                onChangeText={setOperarioBusqueda}
                                placeholder="Digitar CC o Nombre..."
                                placeholderTextColor="#4b5563"
                                style={inputStyle}
                            />

                            {/* Resultados filtrados del mock en caliente */}
                            {operariosMock
                                .filter(o => o.id.includes(operarioBusqueda) || o.fullName.toLowerCase().includes(operarioBusqueda.toLowerCase()))
                                .map(operario => (
                                    <TouchableOpacity
                                        key={operario.id}
                                        onPress={() => setOperarioSeleccionado(operario)}
                                        style={{ backgroundColor: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <View>
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{operario.fullName}</Text>
                                            <Text style={{ color: '#6b7280', fontSize: 12 }}>CC: {operario.id} • {operario.cargo}</Text>
                                        </View>
                                        <Text style={{ color: '#00b4d8', fontSize: 12, fontWeight: 'bold' }}>Seleccionar ➔</Text>
                                    </TouchableOpacity>
                                ))}
                        </View>
                    ) : (
                        /* OPERARIO YA SELECCIONADO (Muestra Badge de Confirmación) */
                        <View style={[cardStyle, { borderColor: '#10b981', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                            <View>
                                <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold' }}>✓ OPERARIO VINCULADO</Text>
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>{operarioSeleccionado.fullName}</Text>
                                <Text style={{ color: '#6b7280', fontSize: 12 }}>Cédula: {operarioSeleccionado.id}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setOperarioSeleccionado(null)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 6, borderRadius: 6 }}>
                                <Text style={{ color: '#f87171', fontSize: 11 }}>Cambiar</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* PASO B: FORMULARIO DINÁMICO DE CARGA DE ARTÍCULO */}
                    {operarioSeleccionado && (
                        <View style={cardStyle}>
                            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>2. DETALLES DEL MATERIAL O DOTACIÓN</Text>

                            {/* Selector de Tipo de Carga */}
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                                <TouchableOpacity
                                    onPress={() => setTipoEntrega('DOTACION')}
                                    style={{ flex: 1, backgroundColor: tipoEntrega === 'DOTACION' ? 'rgba(168, 85, 247, 0.2)' : '#1f2937', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: tipoEntrega === 'DOTACION' ? '#a855f7' : 'transparent', alignItems: 'center' }}
                                >
                                    <Text style={{ color: tipoEntrega === 'DOTACION' ? '#c084fc' : '#9ca3af', fontSize: 12, fontWeight: 'bold' }}>👕 Dotación de Ley</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTipoEntrega('HERRAMIENTA')}
                                    style={{ flex: 1, backgroundColor: tipoEntrega === 'HERRAMIENTA' ? 'rgba(59, 130, 246, 0.2)' : '#1f2937', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: tipoEntrega === 'HERRAMIENTA' ? '#60a5fa' : 'transparent', alignItems: 'center' }}
                                >
                                    <Text style={{ color: tipoEntrega === 'HERRAMIENTA' ? '#60a5fa' : '#9ca3af', fontSize: 12, fontWeight: 'bold' }}>🔧 Activo / Herramienta</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>SELECCIONAR ARTÍCULO DEL STOCK</Text>
                            <TextInput
                                value={articuloSeleccionadoForm}
                                onChangeText={setArticuloSeleccionadoForm}
                                placeholder="Ej: Casco Blanco o Taladro Dewalt"
                                placeholderTextColor="#4b5563"
                                style={inputStyle}
                            />

                            {/* CAMPOS CONDICIONALES BASADOS EN EL TIPO DE ELEMENTO ENTREGADO */}
                            {tipoEntrega === 'DOTACION' ? (
                                <View>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>TALLA DE LA PRENDA / CALZADO</Text>
                                    <TextInput
                                        value={tallaPrenda}
                                        onChangeText={setTallaPrenda}
                                        placeholder="Ej: M, L, XL o Talla 40"
                                        placeholderTextColor="#4b5563"
                                        style={inputStyle}
                                    />
                                </View>
                            ) : (
                                <View>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>NÚMERO DE SERIE / IDENTIFICADOR ÚNICO</Text>
                                    <TextInput
                                        value={serieHerramienta}
                                        onChangeText={setSerieHerramienta}
                                        placeholder="Ej: DEWALT-2026-XYZ"
                                        placeholderTextColor="#4b5563"
                                        style={inputStyle}
                                    />
                                </View>
                            )}

                            {/* BOTÓN FINAL DE REGISTRO */}
                            <TouchableOpacity
                                onPress={() => {
                                    alert(`✓ Remisión guardada con éxito para ${operarioSeleccionado.fullName}`);
                                    setModalVisible(false);
                                    setOperarioSeleccionado(null);
                                }}
                                style={{ backgroundColor: '#10b981', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>Asentar Despacho en ERP</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </View>
            )}

        </ScrollView>
    );
}
