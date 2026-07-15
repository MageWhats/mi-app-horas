import { useRouter } from 'expo-router'; // 🛡️ CORREGIDO EL NOMBRE DE LA IMPORTACIÓN
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// Import del proveedor de contexto (exportado desde WorkHoursContext)
const { WorkHoursProvider } = require('../../context/WorkHoursContext');


export function AdminDashboard() {
  // 🛡️ ACCESO DIRECTO UNIVERSAL EN CALIENTE (SALTA ERRORES DE HOOKS FANTASMAS)
  const { user, userRole, loading } = useContext(require('../../context/WorkHoursContext').WorkHoursContext) as any;
  
  const router = useRouter(); // 🛡️ CORREGIDA LA FUNCIÓN CON MINÚSCULA

    // 🔍 LECTOR DE EMPLEADOS DESDE FIRESTORE
  useEffect(() => {
    if (userRole === 'admin') {
      obtenerListaEmpleados();
    }
  }, [userRole]);

  
  const [busqueda, setBusqueda] = useState('');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);



  // 🛡️ ESCUDO VISUAL MAESTRO: Si Firebase está pensando o descargando el rol, congelamos la pantalla en modo carga
  if (loading || userRole === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b132b', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00f5d4" />
        <Text style={{ color: '#ffffff', marginTop: 15, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 }}>
          Autenticando credenciales de Mar Profundo...
        </Text>
      </View>
    );
  }

  // 🛡️ FILTRO DE SEGURIDAD ABSOLUTO: Ya sabemos el rol real. Si dio diferente de admin, lo expulsamos de una
  if (userRole !== 'admin') {
    router.replace('/(tabs)' as any);
    return null; // Rompe el ciclo para que no intente pintar nada más abajo
  }


  const obtenerListaEmpleados = async () => {
    setCargandoLista(true);
    try {
      const { collection, getDocs, query, where } = require('firebase/firestore');
      const { db } = require('../../lib/firebase'); 

      
      // Jalamos todos los usuarios cuyo rol sea 'employee'
      const q = query(collection(db, 'users'), where('role', '==', 'employee'));
      const querySnapshot = await getDocs(q);
      
      const lista: any[] = [];
      querySnapshot.forEach((docSnap: any) => {
        lista.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      setEmpleados(lista);
    } catch (error) {
      console.error("Error al cargar empleados en el Dashboard:", error);
    } finally {
      setCargandoLista(false);
    }
  };

  // Filtrado en vivo por texto (Nombre o Cédula)
  const empleadosFiltrados = empleados.filter(emp => 
    emp.name?.toLowerCase().includes(busqueda.toLowerCase()) || 
    emp.cedula?.includes(busqueda)
  );
/*
  if (loading || userRole !== 'admin') {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#00f5d4" />
        <Text style={styles.textoCargando}>Verificando credenciales de seguridad...</Text>
      </View>
    );
  }
*/
  return (
    <View style={styles.contenedor}>
      {/* Cabecera Principal */}
      <View style={styles.header}>
        <Text style={styles.titulo}>PANEL GERENCIAL DE NÓMINA</Text>
        <Text style={styles.subtitulo}>Mar Profundo — Control de Operarios</Text>
      </View>

      {/* Barra de Búsqueda Avanzada */}
      <TextInput
        style={styles.buscador}
        placeholder="🔍 Buscar operario por nombre o cédula..."
        placeholderTextColor="#8d99ae"
        value={busqueda}
        onChangeText={setBusqueda}
      />

      {/* Lista de Personal */}
      {cargandoLista ? (
        <ActivityIndicator size="large" color="#00f5d4" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={empleadosFiltrados}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.textoVacio}>No se encontraron operarios registrados.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.tarjetaEmpleado}>
              <View style={styles.infoCol}>
                <Text style={styles.nombreEmp}>{item.name || 'Operario Sin Nombre'}</Text>
                <Text style={styles.cedulaEmp}>C.C. {item.cedula || '---'}</Text>
                <Text style={styles.cargoEmp}>{item.cargo || 'Pescador / Operario'}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.botonLiquidar}
                onPress={() => alert(`Abriendo prenómina de: ${item.name}`)}
              >
                <Text style={styles.textoBoton}>Liquidar Nómina</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#0b132b', padding: 20, paddingTop: 40 },
  centro: { flex: 1, backgroundColor: '#0b132b', justifyContent: 'center', alignItems: 'center' },
  textoCargando: { color: '#ffffff', marginTop: 15, fontSize: 14, fontWeight: '600' },
  header: { marginBottom: 25 },
  titulo: { color: '#00f5d4', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  subtitulo: { color: '#8d99ae', fontSize: 13, fontWeight: '600', marginTop: 2 },
  buscador: { backgroundColor: '#1c2541', color: '#ffffff', padding: 14, borderRadius: 12, fontSize: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(58, 79, 124, 0.3)' },
  tarjetaEmpleado: { backgroundColor: '#111936', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0, 245, 212, 0.1)' },
  infoCol: { flex: 1, gap: 3 },
  nombreEmp: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  cedulaEmp: { color: '#8d99ae', fontSize: 12, fontWeight: '600' },
  cargoEmp: { color: '#00f5d4', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  botonLiquidar: { backgroundColor: '#3a86ff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  textoBoton: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  textoVacio: { color: '#8d99ae', textAlign: 'center', marginTop: 40, fontSize: 14, fontWeight: '600' }
});

// 🛡️ ENVOLTURA MAESTRA MULTIPLATAFORMA
export default function AdminDashboardWrapper() {
  return (
    <WorkHoursProvider>
      <AdminDashboard />
    </WorkHoursProvider>
  );
}


