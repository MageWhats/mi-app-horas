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
  getUltimaMarcaRealtime,
  startOfDay,
  toLocalDateStr,
} from '../lib/utils';
import { DayEntry, Marca, MonthlySummary, TipoMarca } from '../types/hours';

export type ManualEntryInput =
  | { mode: 'HORARIO'; startTime: string; endTime: string }
  | { mode: 'JORNADA'; hours: number };

interface DayDetails {
  isHolidayOrSunday: boolean;
  notes: string | null;
}

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
  /** Sin coordenadas es obligatorio el motivo. */
  punchInRealTime: (coords: GeoCoords | null, motivoSinGps?: string) => Promise<'ENTRADA' | 'SALIDA'>;
  /** Marca que se registrará al ponchar ahora. */
  proximaMarca: 'ENTRADA' | 'SALIDA';
  addManualEntry: (date: string, input: ManualEntryInput, details: DayDetails) => Promise<void>;
  updateDayDetails: (date: string, details: DayDetails) => Promise<void>;
  deleteDayEntry: (date: string) => Promise<void>;
  exportCurrentMonth: () => Promise<void>;
}

// ─── Filas de la base de datos ───────────────────────────────────────────────

interface JornadaRow {
  fecha: string;
  es_festivo: boolean;
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
  corte_medianoche: boolean;
  created_at: string;
}

const MARCA_COLUMNS = 'id, fecha, tipo, momento, hora_ingreso, hora_salida, horas, latitud, longitud, precision_m, zona, motivo_sin_gps, corte_medianoche, created_at';

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
  corteMedianoche: row.corte_medianoche,
});

/** Orden cronológico: las marcas en tiempo real por su instante, las manuales por su creación. */
const ordenMarcas = (a: MarcaRow, b: MarcaRow) =>
  (a.momento ?? a.created_at).localeCompare(b.momento ?? b.created_at) || a.created_at.localeCompare(b.created_at);

/**
 * Horas del día a partir de todas sus marcas:
 * tramos en tiempo real + registros manuales por horario + jornadas directas.
 */
const computeDayTotals = (date: string, marcas: Marca[]) => {
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
    const tieneRealtime = marcas.some((m) => m.tipo === 'ENTRADA' || m.tipo === 'SALIDA');

    result[date] = {
      date,
      hours: totalHours,
      totalHours,
      nightHours,
      isHolidayOrSunday: detalle?.es_festivo ?? false,
      notes: detalle?.notas ?? null,
      tipoIngreso: tieneRealtime ? 'REALTIME' : marcas[0]?.tipo ?? 'MANUAL',
      marcas,
    };
  });

  return result;
};

const fetchRange = async (desde: string, hasta: string) => {
  const [jornadas, marcas] = await Promise.all([
    supabase.from('jornadas').select('fecha, es_festivo, notas').gte('fecha', desde).lte('fecha', hasta),
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'marcas', filter: filtro }, refresh)
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

  const marcaRealtime = (tipo: 'ENTRADA' | 'SALIDA', fecha: string, instante: Date, coords: GeoCoords | null, motivoSinGps?: string) => ({
    fecha,
    tipo,
    momento: instante.toISOString(),
    latitud: coords?.latitude ?? null,
    longitud: coords?.longitude ?? null,
    precision_m: coords?.accuracy ?? null,
    motivo_sin_gps: coords ? null : motivoSinGps?.trim() || null,
  });

  const marcaCorte = (tipo: 'ENTRADA' | 'SALIDA', fecha: string, medianoche: Date) => ({
    fecha,
    tipo,
    momento: medianoche.toISOString(),
    zona: 'Corte de medianoche',
    corte_medianoche: true,
  });

  const proximaMarca = openShift ? 'SALIDA' : 'ENTRADA';

  /** Registra la siguiente marca (ENTRADA o SALIDA) según el turno abierto y devuelve cuál fue. */
  const punchInRealTime = async (coords: GeoCoords | null, motivoSinGps?: string) => {
    // La base de datos también lo exige (restricción marca_con_gps_o_motivo)
    if (!coords && !motivoSinGps?.trim()) {
      throw new Error('Una marca sin GPS requiere un motivo.');
    }

    const now = new Date();
    const hoy = toLocalDateStr(now);
    const tipo = proximaMarca;

    // Turno que cruzó la medianoche: se corta a las 00:00 para que cada día lleve sus propias horas
    // (nocturnas, dominicales y festivas se liquidan según el día en que realmente se trabajaron).
    // Un único insert de varias filas es atómico.
    const filas = openShift && openShift.date !== hoy
      ? [
        marcaCorte('SALIDA', openShift.date, startOfDay(hoy)),
        marcaCorte('ENTRADA', hoy, startOfDay(hoy)),
        marcaRealtime('SALIDA', hoy, now, coords, motivoSinGps),
      ]
      : [marcaRealtime(tipo, hoy, now, coords, motivoSinGps)];

    const { error } = await supabase.from('marcas').insert(filas);
    if (error) throw error;
    refresh();
    return tipo;
  };

  const addManualEntry = async (date: string, input: ManualEntryInput, details: DayDetails) => {
    const { error } = await supabase.rpc('registrar_manual', {
      p_fecha: date,
      p_es_festivo: details.isHolidayOrSunday,
      p_notas: details.notes,
      p_hora_ingreso: input.mode === 'HORARIO' ? input.startTime : null,
      p_hora_salida: input.mode === 'HORARIO' ? input.endTime : null,
      p_horas: input.mode === 'JORNADA' ? input.hours : null,
    });
    if (error) throw error;
    refresh();
  };

  const updateDayDetails = async (date: string, details: DayDetails) => {
    const { error } = await supabase.from('jornadas').upsert(
      { fecha: date, es_festivo: details.isHolidayOrSunday, notas: details.notes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,fecha' },
    );
    if (error) throw error;
    refresh();
  };

  const deleteDayEntry = async (date: string) => {
    const { error } = await supabase.rpc('eliminar_jornada', { p_fecha: date });
    if (error) throw error;
    refresh();
  };

  const exportCurrentMonth = () => exportMonthToExcel(entries, summary, currentDate);

  return (
    <WorkHoursContext.Provider value={{
      user, entries, openShift, proximaMarca, currentDate, summary, loading, globalSeconds,
      goToPrevMonth, goToNextMonth, punchInRealTime, addManualEntry, updateDayDetails, deleteDayEntry, exportCurrentMonth,
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
