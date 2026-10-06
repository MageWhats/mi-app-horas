// app/(operario)/equipo.tsx
// Vista de supervisor: estado y horas del mes de todo el equipo (solo lectura y solo datos laborales).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { TextField } from '../../components/form/FormField';
import { MonthNavigator } from '../../components/MonthNavigator';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TabBarIcon } from '../../components/TabBarIcon';
import { useWorkHours } from '../../context/WorkHoursContext';
import { mostrarAlerta } from '../../lib/alert';
import { contarAlertas, exportEquipoToExcel } from '../../lib/excelReport';
import { fetchEquipo } from '../../lib/marcas';
import { supabase } from '../../lib/supabase';
import { alpha, Paleta, useTheme, useThemedStyles } from '../../lib/theme';
import { addDays, calculateMonthlySummary, getUltimaMarcaRealtime, nombreFestivo, toLocalDateStr } from '../../lib/utils';
import { DayEntry, Marca, MonthlySummary } from '../../types/hours';

interface Operario {
  id: string;
  cedula: string;
  full_name: string;
  cuenta_eliminada: boolean;
}

interface FilaEquipo extends Operario {
  entries: Record<string, DayEntry>;
  summary: MonthlySummary;
  alertas: number;
  enTurnoDesde: string | null; // hora de la ENTRADA abierta
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const horaCorta = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function EquipoScreen() {
  const { esSupervisor, currentDate } = useWorkHours();
  const { colors: c } = useTheme();
  const styles = useThemedStyles(crearEstilos);

  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [mes, setMes] = useState<Record<string, Record<string, DayEntry>>>({});
  const [recientes, setRecientes] = useState<Record<string, Record<string, DayEntry>>>({});
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<FilaEquipo | null>(null);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    const hoy = toLocalDateStr();
    const desde = toLocalDateStr(currentDate);
    const hasta = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
    const [equipo, datosMes, datosRecientes] = await Promise.all([
      supabase.rpc('operarios_equipo'),
      fetchEquipo(desde, hasta),
      fetchEquipo(addDays(hoy, -1), hoy),
    ]);
    if (equipo.error) throw equipo.error;
    setOperarios((equipo.data ?? []) as Operario[]);
    setMes(datosMes);
    setRecientes(datosRecientes);
  }, [currentDate]);

  useEffect(() => {
    if (!esSupervisor) return;
    setCargando(true);
    cargar()
      .catch((e) => { console.error(e); mostrarAlerta('No se pudo cargar el equipo', 'Revisa tu conexión.'); })
      .finally(() => setCargando(false));
  }, [esSupervisor, cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } catch (e) { console.error(e); } finally { setRefrescando(false); }
  };

  const filas = useMemo<FilaEquipo[]>(() => {
    const hoy = toLocalDateStr();
    const ayer = addDays(hoy, -1);
    return operarios.map((o) => {
      const entries = mes[o.id] ?? {};
      const reciente = recientes[o.id] ?? {};
      const ultimaHoy = getUltimaMarcaRealtime(reciente[hoy]?.marcas);
      const ultima = ultimaHoy ?? getUltimaMarcaRealtime(reciente[ayer]?.marcas);
      return {
        ...o,
        entries,
        summary: calculateMonthlySummary(Object.values(entries), currentDate.getFullYear(), currentDate.getMonth()),
        alertas: contarAlertas(entries),
        enTurnoDesde: ultima?.tipo === 'ENTRADA' ? ultima.timestamp ?? null : null,
      };
    });
  }, [operarios, mes, recientes, currentDate]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return q ? filas.filter((f) => normalizar(f.full_name).includes(q) || f.cedula.includes(q)) : filas;
  }, [filas, busqueda]);

  const enTurno = filas.filter((f) => f.enTurnoDesde).length;
  const activos = filas.filter((f) => !f.cuenta_eliminada).length;

  const exportar = async () => {
    setExportando(true);
    try {
      await exportEquipoToExcel(
        filas.map((f) => ({ nombre: f.full_name, cedula: f.cedula, entries: f.entries, summary: f.summary })),
        currentDate,
      );
    } catch (e) {
      console.error(e);
      mostrarAlerta('No se pudo generar el reporte del equipo.');
    } finally {
      setExportando(false);
    }
  };

  if (!esSupervisor) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Equipo" />
        <Text style={{ color: c.textMuted, marginTop: 24, textAlign: 'center' }}>Esta sección es solo para supervisores.</Text>
      </ScreenContainer>
    );
  }

  const metrica = (valor: number, etiqueta: string) => (
    <View style={styles.metrica}>
      <Text style={styles.metricaValor}>{valor}</Text>
      <Text style={styles.metricaEtiqueta}>{etiqueta}</Text>
    </View>
  );

  return (
    <ScreenContainer>
      <FlatList
        data={visibles}
        keyExtractor={(f) => f.id}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.primary} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <ScreenHeader title="Equipo" subtitle={`${activos} operarios · ${enTurno} en turno ahora`} />
            <MonthNavigator />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField value={busqueda} onChangeText={setBusqueda} placeholder="Buscar por nombre o cédula" icon="person-outline" />
              </View>
              <TouchableOpacity onPress={exportar} disabled={exportando || filas.length === 0} style={[styles.botonExcel, (exportando || !filas.length) && { opacity: 0.5 }]} accessibilityLabel="Exportar Excel del equipo">
                {exportando ? <ActivityIndicator color={c.onPrimary} /> : <TabBarIcon name="calendar" size={20} color={c.onPrimary} />}
              </TouchableOpacity>
            </View>
            {cargando && <ActivityIndicator color={c.primary} style={{ marginVertical: 24 }} />}
          </View>
        }
        ListEmptyComponent={!cargando ? <Text style={styles.vacio}>No hay operarios que coincidan.</Text> : null}
        renderItem={({ item: f }) => (
          <TouchableOpacity onPress={() => setSeleccionado(f)} activeOpacity={0.85} style={styles.tarjeta}>
            <View style={styles.filaSuperior}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre} numberOfLines={1}>{f.full_name}</Text>
                <Text style={styles.cedula}>CC {f.cedula}{f.cuenta_eliminada ? ' · Cuenta eliminada' : ''}</Text>
              </View>
              <View style={[styles.pildora, { backgroundColor: alpha(f.enTurnoDesde ? c.success : c.textFaint, 0.14) }]}>
                <View style={[styles.punto, { backgroundColor: f.enTurnoDesde ? c.success : c.textFaint }]} />
                <Text style={[styles.pildoraTexto, { color: f.enTurnoDesde ? c.success : c.textMuted }]}>
                  {f.enTurnoDesde ? `En turno · ${horaCorta(f.enTurnoDesde)}` : 'Fuera'}
                </Text>
              </View>
            </View>
            <View style={styles.metricas}>
              {metrica(f.summary.totalHours, 'horas')}
              {metrica(f.summary.totalHorasExtras, 'extras')}
              {metrica(f.summary.totalRecargoNocturno, 'nocturnas')}
              {metrica(f.summary.totalHoursWithRecargo, 'dom/fest')}
            </View>
            {f.alertas > 0 && (
              <View style={styles.alerta}>
                <TabBarIcon name="alert-circle" size={14} color={c.warning} />
                <Text style={styles.alertaTexto}>{f.alertas === 1 ? '1 marca por revisar' : `${f.alertas} marcas por revisar`}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      <DetalleOperario fila={seleccionado} onCerrar={() => setSeleccionado(null)} />
    </ScreenContainer>
  );
}

/** Detalle del mes de un operario: días, marcas, alertas y ubicación en el mapa. */
function DetalleOperario({ fila, onCerrar }: { fila: FilaEquipo | null; onCerrar: () => void }) {
  const { colors: c } = useTheme();
  const styles = useThemedStyles(crearEstilos);
  if (!fila) return null;

  const dias = Object.values(fila.entries).sort((a, b) => b.date.localeCompare(a.date));
  const verMapa = (m: Marca) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}`);

  const etiquetas = (m: Marca) => [
    m.anulada && 'anulada',
    m.motivoSinGps && 'sin GPS',
    m.ubicacionSimulada && 'GPS simulado',
    m.sinConexion && 'sin conexión',
    m.corteMedianoche && 'corte 00:00',
  ].filter(Boolean).join(' · ');

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
        <View style={styles.hoja}>
          <View style={[styles.filaSuperior, { marginBottom: 14 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{fila.full_name}</Text>
              <Text style={styles.cedula}>CC {fila.cedula} · {fila.summary.totalHours} h en el mes</Text>
            </View>
            <TouchableOpacity onPress={onCerrar} style={{ padding: 8, borderRadius: 20, backgroundColor: c.surfaceAlt }} accessibilityLabel="Cerrar">
              <TabBarIcon name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {dias.length === 0 && <Text style={styles.vacio}>Sin registros este mes.</Text>}
            {dias.map((d) => (
              <View key={d.date} style={styles.dia}>
                <View style={styles.filaSuperior}>
                  <Text style={styles.diaFecha}>{d.date.slice(8)}/{d.date.slice(5, 7)}</Text>
                  {d.isHolidayOrSunday && (
                    <Text style={styles.diaFestivo} numberOfLines={1}>{nombreFestivo(d.date) ?? 'Domingo'}</Text>
                  )}
                  <Text style={styles.diaHoras}>{Math.round(d.hours * 10) / 10} h</Text>
                </View>
                {(d.marcas ?? []).map((m) => (
                  <View key={m.id} style={styles.marca}>
                    <Text style={[styles.marcaTexto, m.anulada && { textDecorationLine: 'line-through' }]}>
                      {m.tipo === 'MANUAL_JORNADA' ? 'JORNADA' : m.tipo} · {m.hora.toLowerCase()}
                    </Text>
                    {!!etiquetas(m) && <Text style={styles.marcaEtiquetas}>{etiquetas(m)}</Text>}
                    {m.latitude != null && m.longitude != null && (
                      <TouchableOpacity onPress={() => verMapa(m)} style={styles.mapa} accessibilityLabel="Ver en el mapa">
                        <TabBarIcon name="map" size={14} color={c.primary} />
                        <Text style={styles.mapaTexto}>Mapa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {!!d.notes && <Text style={styles.notas}>{d.notes}</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  botonExcel: { width: 50, borderRadius: 12, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center' },
  vacio: { color: c.textFaint, textAlign: 'center', marginTop: 24 },
  tarjeta: { backgroundColor: c.surface, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  filaSuperior: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombre: { color: c.text, fontSize: 16, fontWeight: '700' },
  cedula: { color: c.textFaint, fontSize: 12, marginTop: 2 },
  pildora: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  pildoraTexto: { fontSize: 12, fontWeight: '700' },
  metricas: { flexDirection: 'row', marginTop: 14, gap: 8 },
  metrica: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  metricaValor: { color: c.text, fontSize: 16, fontWeight: '800' },
  metricaEtiqueta: { color: c.textFaint, fontSize: 11, marginTop: 1 },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  alertaTexto: { color: c.warning, fontSize: 12, fontWeight: '700' },
  hoja: {
    backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%',
    borderWidth: 1, borderColor: c.border, width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  dia: { backgroundColor: c.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.border },
  diaFecha: { color: c.text, fontSize: 15, fontWeight: '800' },
  diaFestivo: { flex: 1, color: c.warning, fontSize: 11, fontWeight: '700' },
  diaHoras: { color: c.cyan, fontSize: 14, fontWeight: '800', marginLeft: 'auto' },
  marca: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  marcaTexto: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  marcaEtiquetas: { color: c.warning, fontSize: 11, fontWeight: '700' },
  mapa: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: alpha(c.primary, 0.1) },
  mapaTexto: { color: c.primary, fontSize: 11, fontWeight: '700' },
  notas: { color: c.textFaint, fontSize: 12, fontStyle: 'italic', marginTop: 6 },
});
