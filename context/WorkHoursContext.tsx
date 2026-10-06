// context/WorkHoursContext.tsx
import type { User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { exportMonthToExcel } from '../lib/excelReport';
import { GeoCoords } from '../lib/location';
import { supabase } from '../lib/supabase';
import {
  addDays,
  calculateHoursAndNightSplit,
  calculateMonthlySummary,
  calculateRealtimeHours,
  esDomingoOFestivo,
  getUltimaMarcaRealtime,
  parseHoraAMinutos,
  toLocalDateStr,
} from '../lib/utils';
import { DayEntry, Marca, MonthlySummary, TipoMarca } from '../types/hours';

export type ManualEntryInput =
  | { mode: 'HORARIO'; startTime: string; endTime: string }
  | { mode: 'JORNADA'; hours: number };

/** Turno en tiempo real sin SALIDA. Puede haber empezado ayer (turno nocturno). */
export interface OpenShift {
  date: string;
  entrada: Marca;
}

interface WorkHoursContextType {
  user: User | null;
  entries: Record<string, DayEntry>;
  openShift: OpenShift | null;
  currentDate: Date;
  summary: MonthlySummary;
  loading: boolean;
  globalSeconds: number;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  /** La hora la pone el servidor. Sin coordenadas es obligatorio el motivo. */
  punchInRealTime: (coords: GeoCoords | null, motivoSinGps?: string) => Promise<'ENTRADA' | 'SALIDA'>;
  /** Marca que se registrará al ponchar ahora (el servidor tiene la última palabra). */
  proximaMarca: 'ENTRADA' | 'SALIDA';
  addManualEntry: (date: string, input: ManualEntryInput, notes: string | null) => Promise<void>;
  updateNotes: (date: string, notes: string | null) => Promise<void>;
  /** Anula un registro manual (no se borra) */
  anularMarca: (marcaId: string, motivo: string) => Promise<void>;
  exportCurrentMonth: () => Promise<void>;
}

// ─── Filas de la base de datos ───────────────────────────────────────────────

interface JornadaRow {
  fecha: string;
  notas: string | null;
}

interface MarcaRow {
  id: string;
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
  anulada_en: string | null;
  motivo_anulacion: string | null;
  created_at: string;
}

const MARCA_COLUMNS = 'id, fecha, tipo, momento, hora_ingreso, hora_salida, horas, latitud, longitud, precision_m, zona, motivo_sin_gps, ubicacion_simulada, corte_medianoche, anulada_en, motivo_anulacion, created_at';

const formatHora = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

const toMarca = (row: MarcaRow): Marca => ({
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
  anulada: row.anulada_en !== null,
  motivoAnulacion: row.motivo_anulacion ?? undefined,
});

/** Orden cronológico: las marcas en tiempo real por su instante, las manuales por su creación. */
const ordenMarcas = (a: MarcaRow, b: MarcaRow) =>
  (a.momento ?? a.created_at).localeCompare(b.momento ?? b.created_at) || a.created_at.localeCompare(b.created_at);

/**
 * Horas del día a partir de sus marcas vigentes (las anuladas no suman):
 * tramos en tiempo real + registros manuales por horario + jornadas directas.
 */
const computeDayTotals = (date: string, todas: Marca[]) => {
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

/** Arma los días a partir de las filas de jornadas y marcas. */
const buildEntries = (jornadas: JornadaRow[], marcaRows: MarcaRow[]): Record<string, DayEntry> => {
  const marcasPorDia: Record<string, Marca[]> = {};
  [...marcaRows].sort(ordenMarcas).forEach((row) => {
    (marcasPorDia[row.fecha] ??= []).push(toMarca(row));
  });

  const detalles: Record<string, JornadaRow> = {};
  jornadas.forEach((j) => { detalles[j.fecha] = j; });

  const fechas = new Set([...Object.keys(marcasPorDia), ...Object.keys(detalles)]);
  const result: Record<string, DayEntry> = {};

  fechas.forEach((date) => {
    const marcas = marcasPorDia[date] ?? [];
    const { totalHours, nightHours } = computeDayTotals(date, marcas);
    const detalle = detalles[date];

    result[date] = {
      date,
      hours: totalHours,
      nightHours,
      isHolidayOrSunday: esDomingoOFestivo(date),
      notes: detalle?.notas ?? null,
      marcas,
    };
  });

  return result;
};

const fetchRange = async (desde: string, hasta: string) => {
  const [jornadas, marcas] = await Promise.all([
    supabase.from('jornadas').select('fecha, notas').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('marcas').select(MARCA_COLUMNS).gte('fecha', desde).lte('fecha', hasta),
  ]);
  if (jornadas.error) throw jornadas.error;
  if (marcas.error) throw marcas.error;
  return buildEntries(jornadas.data as JornadaRow[], marcas.data as MarcaRow[]);
};

const WorkHoursContext = createContext<WorkHoursContextType | undefined>(undefined);

export const WorkHoursProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [recent, setRecent] = useState<Record<string, DayEntry>>({}); // ayer y hoy
  const [todayStr, setTodayStr] = useState(toLocalDateStr());
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [globalSeconds, setGlobalSeconds] = useState(0);
  const [version, setVersion] = useState(0); // incrementar fuerza una recarga

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Sesión
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setEntries({});
        setRecent({});
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Detecta el cambio de día (medianoche) y recarga al volver la app a primer plano
  useEffect(() => {
    const interval = setInterval(() => {
      const nuevo = toLocalDateStr();
      setTodayStr((prev) => (prev === nuevo ? prev : nuevo));
    }, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTodayStr(toLocalDateStr());
        refresh();
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  // Días del mes que se está visualizando
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelado = false;
    setLoading(true);

    const desde = toLocalDateStr(currentDate);
    const hasta = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));

    fetchRange(desde, hasta)
      .then((data) => { if (!cancelado) setEntries(data); })
      .catch((error) => console.error('Error cargando el mes:', error))
      .finally(() => { if (!cancelado) setLoading(false); });

    return () => { cancelado = true; };
  }, [user, currentDate, version]);

  // Ayer y hoy, independientes del mes visible: controlan el botón de ponchar
  const yesterdayStr = addDays(todayStr, -1);
  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    fetchRange(yesterdayStr, todayStr)
      .then((data) => { if (!cancelado) setRecent(data); })
      .catch((error) => console.error('Error cargando el día actual:', error));
    return () => { cancelado = true; };
  }, [user, todayStr, yesterdayStr, version]);

  // Sincroniza cambios hechos desde otro dispositivo del mismo operario
  useEffect(() => {
    if (!user) return;
    const filtro = `user_id=eq.${user.id}`;
    const channel = supabase
      .channel(`horas-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marcas', filter: filtro }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas', filter: filtro }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refresh]);

  const todayEntry = recent[todayStr] ?? null;
  const yesterdayEntry = recent[yesterdayStr] ?? null;

  // Turno abierto: la última marca de hoy es ENTRADA, o hoy no hay marcas y ayer quedó una ENTRADA sin cerrar
  const openShift = useMemo<OpenShift | null>(() => {
    const ultimaHoy = getUltimaMarcaRealtime(todayEntry?.marcas);
    if (ultimaHoy) return ultimaHoy.tipo === 'ENTRADA' ? { date: todayStr, entrada: ultimaHoy } : null;

    const ultimaAyer = getUltimaMarcaRealtime(yesterdayEntry?.marcas);
    return ultimaAyer?.tipo === 'ENTRADA' ? { date: yesterdayStr, entrada: ultimaAyer } : null;
  }, [todayEntry, yesterdayEntry, todayStr, yesterdayStr]);

  // Cronómetro del turno abierto
  useEffect(() => {
    const inicio = openShift ? new Date(openShift.entrada.timestamp ?? '').getTime() : NaN;
    if (isNaN(inicio)) {
      setGlobalSeconds(0);
      return;
    }

    const tick = () => setGlobalSeconds(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [openShift]);

  const summary = useMemo(
    () => calculateMonthlySummary(Object.values(entries), currentDate.getFullYear(), currentDate.getMonth()),
    [entries, currentDate],
  );

  const goToPrevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const proximaMarca = openShift ? 'SALIDA' : 'ENTRADA';

  /** "8:30 p. m." o "20:30" → "20:30" (formato que valida la base de datos) */
  const a24h = (hora: string) => {
    const minutos = parseHoraAMinutos(hora);
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  };

  /**
   * Registra la siguiente marca. La fecha, la hora, si es ENTRADA o SALIDA y el corte de medianoche
   * los decide el servidor (función ponchar), así que cambiar la hora del celular no tiene efecto.
   */
  const punchInRealTime = async (coords: GeoCoords | null, motivoSinGps?: string) => {
    const { data, error } = await supabase.rpc('ponchar', {
      p_latitud: coords?.latitude ?? null,
      p_longitud: coords?.longitude ?? null,
      p_precision: coords?.accuracy ?? null,
      p_motivo_sin_gps: coords ? null : motivoSinGps?.trim() || null,
      p_ubicacion_simulada: coords?.simulada ?? false,
    });
    refresh();
    if (error) throw error;
    return data as 'ENTRADA' | 'SALIDA';
  };

  const addManualEntry = async (date: string, input: ManualEntryInput, notes: string | null) => {
    const { error } = await supabase.rpc('registrar_manual', {
      p_fecha: date,
      p_notas: notes,
      p_hora_ingreso: input.mode === 'HORARIO' ? a24h(input.startTime) : null,
      p_hora_salida: input.mode === 'HORARIO' ? a24h(input.endTime) : null,
      p_horas: input.mode === 'JORNADA' ? input.hours : null,
    });
    if (error) throw error;
    refresh();
  };

  const updateNotes = async (date: string, notes: string | null) => {
    const { error } = await supabase.from('jornadas').upsert(
      { fecha: date, notas: notes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,fecha' },
    );
    if (error) throw error;
    refresh();
  };

  const anularMarca = async (marcaId: string, motivo: string) => {
    const { error } = await supabase.rpc('anular_marca', { p_marca_id: marcaId, p_motivo: motivo.trim() });
    if (error) throw error;
    refresh();
  };

  const exportCurrentMonth = () => exportMonthToExcel(entries, summary, currentDate);

  return (
    <WorkHoursContext.Provider value={{
      user, entries, openShift, proximaMarca, currentDate, summary, loading, globalSeconds,
      goToPrevMonth, goToNextMonth, punchInRealTime, addManualEntry, updateNotes, anularMarca, exportCurrentMonth,
    }}>
      {children}
    </WorkHoursContext.Provider>
  );
};

export const useWorkHours = () => {
  const context = useContext(WorkHoursContext);
  if (!context) throw new Error('useWorkHours debe usarse dentro de WorkHoursProvider');
  return context;
};
