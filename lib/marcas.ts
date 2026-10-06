// lib/marcas.ts
// Lectura de marcas y jornadas desde Supabase y armado de los días (lo usan el operario y el supervisor).
import { DayEntry, Marca, TipoMarca } from '../types/hours';
import { supabase } from './supabase';
import { calculateHoursAndNightSplit, calculateRealtimeHours, esDomingoOFestivo } from './utils';

export interface JornadaRow {
  user_id?: string;
  fecha: string;
  notas: string | null;
}

export interface MarcaRow {
  id: string;
  user_id?: string;
  fecha: string;
  tipo: TipoMarca;
  momento: string | null;
  hora_ingreso: string | null;
  hora_salida: string | null;
  horas: number | null;
  latitud: number | null;
  longitud: number | null;
  precision_m: number | null;
  zona: string | null;
  motivo_sin_gps: string | null;
  ubicacion_simulada: boolean;
  corte_medianoche: boolean;
  sin_conexion: boolean;
  anulada_en: string | null;
  motivo_anulacion: string | null;
  created_at: string;
}

const MARCA_COLUMNS = 'id, user_id, fecha, tipo, momento, hora_ingreso, hora_salida, horas, latitud, longitud, precision_m, zona, motivo_sin_gps, ubicacion_simulada, corte_medianoche, sin_conexion, anulada_en, motivo_anulacion, created_at';

export const formatHora = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

export const toMarca = (row: MarcaRow): Marca => ({
  id: row.id,
  tipo: row.tipo,
  hora: row.momento
    ? formatHora(row.momento)
    : row.tipo === 'MANUAL'
      ? `${row.hora_ingreso} - ${row.hora_salida}`
      : `${Number(row.horas)} Horas Netas`,
  timestamp: row.momento ?? row.created_at,
  latitude: row.latitud,
  longitude: row.longitud,
  accuracy: row.precision_m,
  horaIngreso: row.hora_ingreso ?? undefined,
  horaSalida: row.hora_salida ?? undefined,
  totalHours: row.horas != null ? Number(row.horas) : undefined,
  zona: row.zona ?? undefined,
  motivoSinGps: row.motivo_sin_gps ?? undefined,
  ubicacionSimulada: row.ubicacion_simulada,
  corteMedianoche: row.corte_medianoche,
  sinConexion: row.sin_conexion,
  anulada: row.anulada_en !== null,
  motivoAnulacion: row.motivo_anulacion ?? undefined,
});

/** Orden cronológico: las marcas en tiempo real por su instante, las manuales por su creación. */
const ordenMarcas = (a: Marca, b: Marca) => (a.timestamp ?? '').localeCompare(b.timestamp ?? '');

/**
 * Horas del día a partir de sus marcas vigentes (las anuladas no suman):
 * tramos en tiempo real + registros manuales por horario + jornadas directas.
 */
export const computeDayTotals = (date: string, todas: Marca[]) => {
  const marcas = todas.filter((m) => !m.anulada);
  const realtime = calculateRealtimeHours(marcas);
  let totalHours = realtime.totalHours;
  let nightHours = realtime.nightHours;

  for (const marca of marcas) {
    if (marca.tipo === 'MANUAL' && marca.horaIngreso && marca.horaSalida) {
      const split = calculateHoursAndNightSplit(marca.horaIngreso, marca.horaSalida, date);
      totalHours += split.totalHours;
      nightHours += split.nightHours;
    } else if (marca.tipo === 'MANUAL_JORNADA') {
      totalHours += Number(marca.totalHours || 0);
    }
  }

  return {
    totalHours: parseFloat(totalHours.toFixed(4)),
    nightHours: parseFloat(nightHours.toFixed(2)),
  };
};

/** Arma un día a partir de sus marcas y notas. */
export const armarDia = (date: string, marcas: Marca[], notas: string | null): DayEntry => {
  const ordenadas = [...marcas].sort(ordenMarcas);
  const { totalHours, nightHours } = computeDayTotals(date, ordenadas);
  return {
    date,
    hours: totalHours,
    nightHours,
    isHolidayOrSunday: esDomingoOFestivo(date),
    notes: notas,
    marcas: ordenadas,
  };
};

/** Arma los días a partir de las filas de jornadas y marcas de un operario. */
export const buildEntries = (jornadas: JornadaRow[], marcaRows: MarcaRow[]): Record<string, DayEntry> => {
  const marcasPorDia: Record<string, Marca[]> = {};
  marcaRows.forEach((row) => { (marcasPorDia[row.fecha] ??= []).push(toMarca(row)); });

  const notas: Record<string, string | null> = {};
  jornadas.forEach((j) => { notas[j.fecha] = j.notas; });

  const result: Record<string, DayEntry> = {};
  new Set([...Object.keys(marcasPorDia), ...Object.keys(notas)]).forEach((date) => {
    result[date] = armarDia(date, marcasPorDia[date] ?? [], notas[date] ?? null);
  });
  return result;
};

const leerFilas = async (desde: string, hasta: string) => {
  const [jornadas, marcas] = await Promise.all([
    supabase.from('jornadas').select('user_id, fecha, notas').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('marcas').select(MARCA_COLUMNS).gte('fecha', desde).lte('fecha', hasta),
  ]);
  if (jornadas.error) throw jornadas.error;
  if (marcas.error) throw marcas.error;
  return { jornadas: jornadas.data as JornadaRow[], marcas: marcas.data as MarcaRow[] };
};

/** Días del operario con sesión entre dos fechas (RLS solo devuelve sus filas, salvo a un supervisor). */
export const fetchRange = async (desde: string, hasta: string, userId: string) => {
  const { jornadas, marcas } = await leerFilas(desde, hasta);
  return buildEntries(jornadas.filter((j) => j.user_id === userId), marcas.filter((m) => m.user_id === userId));
};

/** Días de todo el equipo entre dos fechas, por operario (solo supervisores). */
export const fetchEquipo = async (desde: string, hasta: string): Promise<Record<string, Record<string, DayEntry>>> => {
  const { jornadas, marcas } = await leerFilas(desde, hasta);
  const usuarios = new Set([...jornadas.map((j) => j.user_id!), ...marcas.map((m) => m.user_id!)]);
  const resultado: Record<string, Record<string, DayEntry>> = {};
  usuarios.forEach((uid) => {
    resultado[uid] = buildEntries(jornadas.filter((j) => j.user_id === uid), marcas.filter((m) => m.user_id === uid));
  });
  return resultado;
};
