// context/WorkHoursContext.tsx
import NetInfo from '@react-native-community/netinfo';
import type { User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { esErrorDeRed, generarIdCliente, guardarCola, leerCola, MarcaPendiente } from '../lib/colaMarcas';
import { mensajeDeError } from '../lib/errores';
import { exportMonthToExcel } from '../lib/excelReport';
import { GeoCoords } from '../lib/location';
import { armarDia, fetchRange, formatHora } from '../lib/marcas';
import { cancelarRecordatorio, pedirPermisoRecordatorios, programarRecordatorio } from '../lib/recordatorios';
import { supabase } from '../lib/supabase';
import {
  addDays,
  calculateMonthlySummary,
  getColombianWeeklyLimit,
  getUltimaMarcaRealtime,
  parseHoraAMinutos,
  startOfDay,
  toLocalDateStr,
} from '../lib/utils';
import { DayEntry, Marca, MonthlySummary } from '../types/hours';

export type ManualEntryInput =
  | { mode: 'HORARIO'; startTime: string; endTime: string }
  | { mode: 'JORNADA'; hours: number };

/** Turno en tiempo real sin SALIDA. Puede haber empezado ayer (turno nocturno). */
export interface OpenShift {
  date: string;
  entrada: Marca;
}

export interface ResultadoPonchado {
  tipo: 'ENTRADA' | 'SALIDA';
  /** Sin señal: quedó guardada en el celular y se enviará sola */
  sinConexion: boolean;
}

interface WorkHoursContextType {
  user: User | null;
  esSupervisor: boolean;
  entries: Record<string, DayEntry>;
  openShift: OpenShift | null;
  currentDate: Date;
  summary: MonthlySummary;
  loading: boolean;
  globalSeconds: number;
  /** Horas de la semana en curso (lunes a hoy, incluido el turno abierto) y límite legal */
  semanaActual: { horas: number; limite: number };
  /** Marcas guardadas sin conexión (pendientes de enviar o rechazadas por el servidor) */
  colaMarcas: MarcaPendiente[];
  descartarMarcaRechazada: (idCliente: string) => Promise<void>;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  /** La hora la pone el servidor. Sin conexión, la marca se guarda y se envía al volver la señal. */
  punchInRealTime: (coords: GeoCoords | null, motivoSinGps?: string) => Promise<ResultadoPonchado>;
  /** Marca que se registrará al ponchar ahora (el servidor tiene la última palabra). */
  proximaMarca: 'ENTRADA' | 'SALIDA';
  addManualEntry: (date: string, input: ManualEntryInput, notes: string | null) => Promise<void>;
  updateNotes: (date: string, notes: string | null) => Promise<void>;
  /** Anula un registro manual (no se borra) */
  anularMarca: (marcaId: string, motivo: string) => Promise<void>;
  exportCurrentMonth: () => Promise<void>;
}

/** Lunes de la semana de una fecha AAAA-MM-DD. */
const inicioSemana = (fecha: string) => addDays(fecha, -((startOfDay(fecha).getDay() + 6) % 7));

/** Agrega a los días las marcas pendientes de enviar (solo las que caen dentro del rango). */
const conPendientes = (
  base: Record<string, DayEntry>,
  cola: MarcaPendiente[],
  dentro: (fecha: string) => boolean,
): Record<string, DayEntry> => {
  const pendientes = cola.filter((p) => p.estado === 'pendiente');
  if (pendientes.length === 0) return base;

  const resultado = { ...base };
  for (const p of pendientes) {
    const fecha = toLocalDateStr(new Date(p.momento));
    if (!dentro(fecha)) continue;
    const marca: Marca = {
      id: p.idCliente,
      tipo: p.tipo,
      hora: formatHora(p.momento),
      timestamp: p.momento,
      latitude: p.coords?.latitude ?? null,
      longitude: p.coords?.longitude ?? null,
      accuracy: p.coords?.accuracy ?? null,
      motivoSinGps: p.coords ? undefined : p.motivoSinGps,
      ubicacionSimulada: p.coords?.simulada ?? false,
      sinConexion: true,
      pendiente: true,
    };
    const dia = resultado[fecha];
    resultado[fecha] = armarDia(fecha, [...(dia?.marcas ?? []), marca], dia?.notes ?? null);
  }
  return resultado;
};

const WorkHoursContext = createContext<WorkHoursContextType | undefined>(undefined);

export const WorkHoursProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [esSupervisor, setEsSupervisor] = useState(false);
  const [entriesBase, setEntriesBase] = useState<Record<string, DayEntry>>({});
  const [recentBase, setRecentBase] = useState<Record<string, DayEntry>>({}); // desde el lunes (o ayer) hasta hoy
  const [colaMarcas, setColaMarcas] = useState<MarcaPendiente[]>([]);
  const [todayStr, setTodayStr] = useState(toLocalDateStr());
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [globalSeconds, setGlobalSeconds] = useState(0);
  const [version, setVersion] = useState(0); // incrementar fuerza una recarga
  const enviandoCola = useRef(false);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Sesión
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setEntriesBase({});
        setRecentBase({});
        setColaMarcas([]);
        setEsSupervisor(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Rol de supervisor
  useEffect(() => {
    if (!user) return;
    supabase.rpc('es_supervisor')
      .then(({ data }) => setEsSupervisor(data === true));
  }, [user]);

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

    fetchRange(desde, hasta, user.id)
      .then((data) => { if (!cancelado) setEntriesBase(data); })
      .catch((error) => console.error('Error cargando el mes:', error))
      .finally(() => { if (!cancelado) setLoading(false); });

    return () => { cancelado = true; };
  }, [user, currentDate, version]);

  // Desde el lunes (o desde ayer, si hoy es lunes) hasta hoy: controla el botón de ponchar y el total semanal
  const yesterdayStr = addDays(todayStr, -1);
  const lunes = inicioSemana(todayStr);
  const desdeReciente = lunes < yesterdayStr ? lunes : yesterdayStr;
  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    fetchRange(desdeReciente, todayStr, user.id)
      .then((data) => { if (!cancelado) setRecentBase(data); })
      .catch((error) => console.error('Error cargando la semana actual:', error));
    return () => { cancelado = true; };
  }, [user, todayStr, desdeReciente, version]);

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

  // ─── Marcas sin conexión ───────────────────────────────────────────────────

  /** Envía en orden las marcas guardadas sin señal. Se detiene en el primer error de red. */
  const enviarCola = useCallback(async () => {
    if (!user || enviandoCola.current) return;
    enviandoCola.current = true;
    try {
      const cola = await leerCola(user.id);
      let restante = [...cola];
      let cambio = false;

      for (const item of cola) {
        if (item.estado !== 'pendiente') continue;
        const { error } = await supabase.rpc('ponchar_sin_conexion', {
          p_id_cliente: item.idCliente,
          p_momento: item.momento,
          p_tipo: item.tipo,
          p_latitud: item.coords?.latitude ?? null,
          p_longitud: item.coords?.longitude ?? null,
          p_precision: item.coords?.accuracy ?? null,
          p_motivo_sin_gps: item.coords ? null : item.motivoSinGps ?? null,
          p_ubicacion_simulada: item.coords?.simulada ?? false,
        });
        if (error && esErrorDeRed(error)) break; // sigue sin señal: se reintenta después
        cambio = true;
        restante = error
          ? restante.map((r) => (r.idCliente === item.idCliente
            ? { ...r, estado: 'rechazada' as const, error: mensajeDeError(error, 'El servidor no aceptó la marca.') }
            : r))
          : restante.filter((r) => r.idCliente !== item.idCliente);
      }

      if (cambio) {
        await guardarCola(user.id, restante);
        setColaMarcas(restante);
        refresh();
      }
    } finally {
      enviandoCola.current = false;
    }
  }, [user, refresh]);

  // Carga la cola guardada y la envía al volver la conexión, al abrir la app y cada minuto si hay pendientes
  useEffect(() => {
    if (!user) return;
    leerCola(user.id).then((cola) => {
      setColaMarcas(cola);
      if (cola.some((c) => c.estado === 'pendiente')) enviarCola();
    });
    const desuscribir = NetInfo.addEventListener((estado) => {
      if (estado.isConnected && estado.isInternetReachable !== false) enviarCola();
    });
    return desuscribir;
  }, [user, enviarCola]);

  const hayPendientes = colaMarcas.some((c) => c.estado === 'pendiente');
  useEffect(() => {
    if (!hayPendientes) return;
    const interval = setInterval(enviarCola, 60_000);
    return () => clearInterval(interval);
  }, [hayPendientes, enviarCola, version]);

  const descartarMarcaRechazada = async (idCliente: string) => {
    if (!user) return;
    const restante = colaMarcas.filter((c) => c.idCliente !== idCliente);
    await guardarCola(user.id, restante);
    setColaMarcas(restante);
  };

  // Los días que se muestran incluyen las marcas aún sin enviar
  const mesActual = toLocalDateStr(currentDate).slice(0, 7);
  const entries = useMemo(
    () => conPendientes(entriesBase, colaMarcas, (f) => f.startsWith(mesActual)),
    [entriesBase, colaMarcas, mesActual],
  );
  const recent = useMemo(
    () => conPendientes(recentBase, colaMarcas, (f) => f >= desdeReciente && f <= todayStr),
    [recentBase, colaMarcas, desdeReciente, todayStr],
  );

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

  // Recordatorio "¿olvidaste marcar la salida?" (notificación local en Android/iOS)
  const idEntradaAbierta = openShift?.entrada.id;
  const inicioTurno = openShift?.entrada.timestamp;
  useEffect(() => {
    if (!user) return;
    if (!inicioTurno) {
      cancelarRecordatorio();
      return;
    }
    programarRecordatorio(new Date(inicioTurno).getTime()).catch((e) => console.warn('Recordatorio:', e));
  }, [user, idEntradaAbierta, inicioTurno]);

  const summary = useMemo(
    () => calculateMonthlySummary(Object.values(entries), currentDate.getFullYear(), currentDate.getMonth()),
    [entries, currentDate],
  );

  // Horas de la semana: tramos cerrados + el turno abierto en curso
  const horasCerradasSemana = useMemo(
    () => Object.values(recent).filter((d) => d.date >= lunes && d.date <= todayStr).reduce((t, d) => t + d.hours, 0),
    [recent, lunes, todayStr],
  );
  const semanaActual = {
    horas: Math.round((horasCerradasSemana + globalSeconds / 3600) * 10) / 10,
    limite: getColombianWeeklyLimit(todayStr),
  };

  const goToPrevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const proximaMarca = openShift ? 'SALIDA' : 'ENTRADA';

  /** "8:30 p. m." o "20:30" → "20:30" (formato que valida la base de datos) */
  const a24h = (hora: string) => {
    const minutos = parseHoraAMinutos(hora);
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  };

  /**
   * Registra la siguiente marca. Con señal, la fecha, la hora, el tipo y el corte de medianoche los decide
   * el servidor (función ponchar). Sin señal, se guarda en el celular y se envía después (ponchar_sin_conexion).
   */
  const punchInRealTime = async (coords: GeoCoords | null, motivoSinGps?: string): Promise<ResultadoPonchado> => {
    if (!user) throw new Error('No hay una sesión activa.');
    const tipo = proximaMarca;

    const guardarSinConexion = async (): Promise<ResultadoPonchado> => {
      const item: MarcaPendiente = {
        idCliente: generarIdCliente(),
        tipo,
        momento: new Date().toISOString(),
        coords,
        motivoSinGps: coords ? undefined : motivoSinGps?.trim(),
        estado: 'pendiente',
      };
      const cola = [...(await leerCola(user.id)), item];
      await guardarCola(user.id, cola);
      setColaMarcas(cola);
      return { tipo, sinConexion: true };
    };

    const despuesDeEntrada = () => {
      if (tipo === 'ENTRADA') pedirPermisoRecordatorios().catch(() => false);
    };

    // Las marcas pendientes van primero, para respetar el orden
    if ((await leerCola(user.id)).some((c) => c.estado === 'pendiente')) {
      await enviarCola();
      if ((await leerCola(user.id)).some((c) => c.estado === 'pendiente')) {
        despuesDeEntrada();
        return guardarSinConexion();
      }
    }

    const { data, error } = await supabase.rpc('ponchar', {
      p_latitud: coords?.latitude ?? null,
      p_longitud: coords?.longitude ?? null,
      p_precision: coords?.accuracy ?? null,
      p_motivo_sin_gps: coords ? null : motivoSinGps?.trim() || null,
      p_ubicacion_simulada: coords?.simulada ?? false,
    });
    if (error) {
      if (esErrorDeRed(error)) {
        despuesDeEntrada();
        return guardarSinConexion();
      }
      refresh();
      throw error;
    }
    refresh();
    despuesDeEntrada();
    return { tipo: data as 'ENTRADA' | 'SALIDA', sinConexion: false };
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
      user, esSupervisor, entries, openShift, proximaMarca, currentDate, summary, loading, globalSeconds, semanaActual,
      colaMarcas, descartarMarcaRechazada,
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
