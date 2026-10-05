// context/WorkHoursContext.tsx
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection, deleteField, doc, getDoc, onSnapshot, query, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { exportMonthToExcel } from '../lib/excelReport';
import { auth, db } from '../lib/firebase';
import {
  addDays,
  calculateHoursAndNightSplit,
  calculateMonthlySummary,
  calculateRealtimeHours,
  getUltimaMarcaRealtime,
  startOfDay,
  toLocalDateStr,
  toYearMonth,
} from '../lib/utils';
import { DayEntry, Marca, MonthlySummary } from '../types/hours';

export type ManualEntryInput =
  | { mode: 'HORARIO'; startTime: string; endTime: string }
  | { mode: 'JORNADA'; hours: number };

interface DayDetails {
  isHolidayOrSunday: boolean;
  notes: string | null;
}

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
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
  punchInRealTime: (coords: GeoCoords | null) => Promise<'ENTRADA' | 'SALIDA'>;
  addManualEntry: (date: string, input: ManualEntryInput, details: DayDetails) => Promise<void>;
  updateDayDetails: (date: string, details: DayDetails) => Promise<void>;
  deleteDayEntry: (date: string) => Promise<void>;
  exportCurrentMonth: () => Promise<void>;
}

type DayMutation = {
  date: string;
  mutate: (actual: DayEntry | null) => Partial<DayEntry> & { marcas: Marca[] };
  /** Con `true` las horas se derivan de las marcas; con `false` se conservan las guardadas. */
  recalcular?: boolean;
};

const WorkHoursContext = createContext<WorkHoursContextType | undefined>(undefined);

const monthDocRef = (uid: string, date: string) => doc(db, 'work_months', `${uid}_${date.slice(0, 7)}`);

const formatHora = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

/** Homologa un día tal como viene de Firestore al modelo de la interfaz. */
const normalizeDay = (fecha: string, raw: any): DayEntry => ({
  ...raw,
  date: raw.date ?? fecha,
  hours: Number(raw.hours ?? raw.totalHours ?? 0),
  nightHours: Number(raw.nightHours ?? 0),
  isHolidayOrSunday: !!raw.isHolidayOrSunday,
  marcas: Array.isArray(raw.marcas) ? raw.marcas : [],
});

/**
 * Recalcula las horas del día a partir de todas sus marcas:
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

/** Escucha un único día en tiempo real. */
const useDaySubscription = (user: User | null, date: string) => {
  const [day, setDay] = useState<DayEntry | null>(null);

  useEffect(() => {
    setDay(null);
    if (!user) return;
    return onSnapshot(monthDocRef(user.uid, date), (snap) => {
      const raw = snap.exists() ? (snap.data().dias || {})[date] : null;
      setDay(raw ? normalizeDay(date, raw) : null);
    }, (error) => console.error(`Error en la escucha del día ${date}:`, error));
  }, [user, date]);

  return day;
};

export const WorkHoursProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [todayStr, setTodayStr] = useState(toLocalDateStr());
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [globalSeconds, setGlobalSeconds] = useState(0);

  // Sesión
  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    if (!firebaseUser) setEntries({});
  }), []);

  // Detecta el cambio de día (medianoche) para que "hoy" no quede congelado con la app abierta
  useEffect(() => {
    const interval = setInterval(() => {
      const nuevo = toLocalDateStr();
      setTodayStr((prev) => (prev === nuevo ? prev : nuevo));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Días del mes que se está visualizando
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const q = query(
      collection(db, 'work_months'),
      where('userId', '==', user.uid),
      where('yearMonth', '==', toYearMonth(currentDate))
    );

    return onSnapshot(q, (snapshot) => {
      const fetched: Record<string, DayEntry> = {};
      snapshot.forEach((d) => {
        const dias = d.data().dias || {};
        Object.keys(dias).forEach((fecha) => {
          fetched[fecha] = normalizeDay(fecha, dias[fecha]);
        });
      });
      setEntries(fetched);
      setLoading(false);
    }, (error) => {
      console.error('Error en la escucha de work_months:', error);
      setLoading(false);
    });
  }, [user, currentDate]);

  // Hoy y ayer se escuchan aparte del mes visible: controlan el botón de ponchar
  const yesterdayStr = addDays(todayStr, -1);
  const todayEntry = useDaySubscription(user, todayStr);
  const yesterdayEntry = useDaySubscription(user, yesterdayStr);

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

  /**
   * Lee los días de Firestore, aplica cada mutación y guarda todo en un único batch atómico.
   * merge: true solo toca la clave de cada día dentro del mapa `dias`.
   */
  const writeDays = async (mutations: DayMutation[]) => {
    if (!user) throw new Error('No hay una sesión activa.');
    const batch = writeBatch(db);

    for (const { date, mutate, recalcular = true } of mutations) {
      const ref = monthDocRef(user.uid, date);
      const snap = await getDoc(ref);
      const raw = snap.exists() ? (snap.data().dias || {})[date] : null;
      const actual = raw ? normalizeDay(date, raw) : null;

      const cambios = mutate(actual);
      const totales = recalcular
        ? computeDayTotals(date, cambios.marcas)
        : { totalHours: actual?.hours ?? 0, nightHours: actual?.nightHours ?? 0 };

      const dia = {
        date,
        isHolidayOrSunday: actual?.isHolidayOrSunday ?? false,
        notes: actual?.notes ?? null,
        tipoIngreso: actual?.tipoIngreso ?? cambios.marcas[0]?.tipo ?? 'MANUAL',
        ...cambios,
        ...totales,
      };

      batch.set(ref, {
        userId: user.uid,
        yearMonth: date.slice(0, 7),
        updatedAt: new Date().toISOString(),
        dias: { [date]: dia },
      }, { merge: true });
    }

    await batch.commit();
  };

  const nuevaMarcaRealtime = (tipo: 'ENTRADA' | 'SALIDA', instante: Date, coords: GeoCoords | null, extra?: Partial<Marca>): Marca => ({
    id: `${tipo.toLowerCase()}-${instante.getTime()}`,
    tipo,
    hora: formatHora(instante),
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    accuracy: coords?.accuracy ?? null,
    timestamp: instante.toISOString(),
    ...extra,
  });

  const appendMarcas = (date: string, marcas: Marca[]): DayMutation => ({
    date,
    mutate: (actual) => ({
      tipoIngreso: actual?.tipoIngreso ?? 'REALTIME',
      marcas: [...(actual?.marcas ?? []), ...marcas],
    }),
  });

  /** Registra la siguiente marca (ENTRADA o SALIDA) según el turno abierto y devuelve cuál fue. */
  const punchInRealTime = async (coords: GeoCoords | null) => {
    const now = new Date();
    const hoy = toLocalDateStr(now);

    if (!openShift) {
      await writeDays([appendMarcas(hoy, [nuevaMarcaRealtime('ENTRADA', now, coords)])]);
      return 'ENTRADA' as const;
    }

    if (openShift.date === hoy) {
      await writeDays([appendMarcas(hoy, [nuevaMarcaRealtime('SALIDA', now, coords)])]);
      return 'SALIDA' as const;
    }

    // Turno que cruzó la medianoche: se corta a las 00:00 para que cada día lleve sus propias horas
    // (nocturnas, dominicales y festivas se liquidan según el día en que realmente se trabajaron).
    const medianoche = startOfDay(hoy);
    const corte = { zona: 'Corte de medianoche' };
    await writeDays([
      appendMarcas(openShift.date, [nuevaMarcaRealtime('SALIDA', medianoche, null, corte)]),
      appendMarcas(hoy, [
        nuevaMarcaRealtime('ENTRADA', medianoche, null, corte),
        nuevaMarcaRealtime('SALIDA', now, coords),
      ]),
    ]);
    return 'SALIDA' as const;
  };

  const addManualEntry = async (date: string, input: ManualEntryInput, details: DayDetails) => {
    const ahora = new Date();
    const marca: Marca = input.mode === 'HORARIO'
      ? {
        id: `manual-${ahora.getTime()}`,
        tipo: 'MANUAL',
        hora: `${input.startTime} - ${input.endTime}`,
        horaIngreso: input.startTime,
        horaSalida: input.endTime,
        zona: 'Registro Manual',
        timestamp: ahora.toISOString(),
      }
      : {
        id: `jornada-${ahora.getTime()}`,
        tipo: 'MANUAL_JORNADA',
        hora: `${input.hours} Horas Netas`,
        totalHours: input.hours,
        zona: 'Registro Jornada Faena',
        timestamp: ahora.toISOString(),
      };

    await writeDays([{
      date,
      mutate: (actual) => ({
        ...details,
        tipoIngreso: actual?.tipoIngreso ?? marca.tipo,
        marcas: [...(actual?.marcas ?? []), marca],
      }),
    }]);
  };

  const updateDayDetails = async (date: string, details: DayDetails) => {
    await writeDays([{
      date,
      mutate: (actual) => ({ ...details, marcas: actual?.marcas ?? [] }),
      recalcular: false,
    }]);
  };

  const deleteDayEntry = async (date: string) => {
    if (!user) throw new Error('No hay una sesión activa.');
    await updateDoc(monthDocRef(user.uid, date), {
      [`dias.${date}`]: deleteField(),
      updatedAt: new Date().toISOString(),
    });
  };

  const exportCurrentMonth = () => exportMonthToExcel(entries, summary, currentDate);

  return (
    <WorkHoursContext.Provider value={{
      user, entries, openShift, currentDate, summary, loading, globalSeconds,
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
