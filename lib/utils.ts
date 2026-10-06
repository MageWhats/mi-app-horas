// lib/utils.ts
import { DayEntry, Marca, MonthlySummary, WeekRange } from '../types/hours';

const MINUTOS_DIA = 24 * 60;
const FIN_NOCHE = 6 * 60; // 6:00 a. m.

// ─── Reglas legales colombianas (dependen de la fecha) ────────────────────────

/**
 * Inicio de la franja nocturna en minutos del día.
 * Ley 2466 de 2025: desde el 25 de diciembre de 2025 la jornada nocturna empieza a las 7:00 p. m. (antes, 9:00 p. m.).
 */
export const getInicioNoche = (date: Date): number =>
  date >= new Date(2025, 11, 25) ? 19 * 60 : 21 * 60;

/** Texto de la franja nocturna vigente en una fecha, para la interfaz. */
export const getFranjaNocturnaLabel = (dateStr: string): string =>
  getInicioNoche(new Date(dateStr + 'T00:00:00')) === 19 * 60 ? '7 p. m. a 6 a. m.' : '9 p. m. a 6 a. m.';

/**
 * Recargo por trabajo en domingo o festivo (Ley 2466 de 2025, gradual cada 1 de julio).
 */
export const getRecargoDominical = (dateStr: string): number => {
  const date = new Date(dateStr + 'T00:00:00');
  if (date >= new Date(2027, 6, 1)) return 100;
  if (date >= new Date(2026, 6, 1)) return 90;
  if (date >= new Date(2025, 6, 1)) return 80;
  return 75;
};

/**
 * Límite semanal según la Ley 2101 de 2021 (cada reducción rige desde el 15 de julio).
 */
export const getColombianWeeklyLimit = (dateStr: string): number => {
  const date = new Date(dateStr + 'T00:00:00');
  const tramos: [number, number][] = [
    [2026, 42],
    [2025, 44],
    [2024, 46],
    [2023, 47],
  ];
  for (const [anio, limite] of tramos) {
    if (date >= new Date(anio, 6, 15)) return limite;
  }
  return 48;
};

const esMinutoNocturno = (minutoDelDia: number, inicioNoche: number) =>
  minutoDelDia >= inicioNoche || minutoDelDia < FIN_NOCHE;

// ─── Fechas ───────────────────────────────────────────────────────────────────

/** Fecha local en formato AAAA-MM-DD (sin el desfase de toISOString, que usa UTC). */
export const toLocalDateStr = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
export const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return toLocalDateStr(date);
};

/** Medianoche local (inicio) de una fecha AAAA-MM-DD. */
export const startOfDay = (dateStr: string): Date => new Date(dateStr + 'T00:00:00');

/**
 * Semanas de calendario (lunes a domingo) recortadas al mes.
 * Un mes puede tener entre 4 y 6 semanas.
 */
export const getWeekRangesOfMonth = (year: number, month: number): WeekRange[] => {
  const diasDelMes = new Date(year, month + 1, 0).getDate();
  const semanas: WeekRange[] = [];
  let desde = 1;

  for (let dia = 1; dia <= diasDelMes; dia++) {
    const esDomingo = new Date(year, month, dia).getDay() === 0;
    if (esDomingo || dia === diasDelMes) {
      semanas.push({ from: desde, to: dia });
      desde = dia + 1;
    }
  }
  return semanas;
};

// ─── Cálculo de horas ─────────────────────────────────────────────────────────

/**
 * Convierte un texto de hora a minutos del día.
 * Acepta formato 24h de la web ("21:30") y 12h de Android/iOS ("9:30 p. m.", "09:30 PM").
 */
export const parseHoraAMinutos = (horaTexto: string): number => {
  const texto = horaTexto.toLowerCase().replace(/\./g, '').trim();
  const esPM = /p\s*m/.test(texto);
  const esAM = /a\s*m/.test(texto);
  const [hrsStr, minsStr] = texto.replace(/(a\s*m|p\s*m)/g, '').trim().split(':');

  let horas = parseInt(hrsStr, 10) || 0;
  const minutos = parseInt(minsStr, 10) || 0;

  if (esPM && horas < 12) horas += 12;
  if (esAM && horas === 12) horas = 0;

  return horas * 60 + minutos;
};

/**
 * Total de horas y cuántas caen en la franja nocturna vigente para `dateStr`.
 * Maneja jornadas que cruzan la medianoche.
 */
export const calculateHoursAndNightSplit = (
  startTime: string,
  endTime: string,
  dateStr: string = toLocalDateStr(),
): { totalHours: number; nightHours: number } => {
  if (!startTime || !endTime) return { totalHours: 0, nightHours: 0 };

  const inicioNoche = getInicioNoche(startOfDay(dateStr));
  const inicio = parseHoraAMinutos(startTime);
  let fin = parseHoraAMinutos(endTime);
  if (fin < inicio) fin += MINUTOS_DIA;

  let nightMinutes = 0;
  for (let m = inicio; m < fin; m++) {
    if (esMinutoNocturno(m % MINUTOS_DIA, inicioNoche)) nightMinutes++;
  }

  return {
    totalHours: Math.round(((fin - inicio) / 60) * 100) / 100,
    nightHours: Math.round((nightMinutes / 60) * 100) / 100,
  };
};

/** Horas nocturnas entre dos instantes reales (en ms), con resolución de un minuto. */
const nightHoursBetween = (startMs: number, endMs: number): number => {
  let nightMinutes = 0;
  const cursor = new Date(startMs);
  cursor.setSeconds(0, 0);
  while (cursor.getTime() < endMs) {
    if (esMinutoNocturno(cursor.getHours() * 60 + cursor.getMinutes(), getInicioNoche(cursor))) nightMinutes++;
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return nightMinutes / 60;
};

/**
 * Suma los tramos ENTRADA → SALIDA de las marcas en tiempo real.
 * Ignora las marcas manuales (sus horas se calculan aparte) para no romper el emparejamiento.
 */
export const calculateRealtimeHours = (marcas: Marca[]): { totalHours: number; nightHours: number } => {
  let totalHours = 0;
  let nightHours = 0;
  let entradaAbierta: Marca | null = null;

  for (const marca of marcas) {
    if (marca.tipo === 'ENTRADA') {
      entradaAbierta = marca;
    } else if (marca.tipo === 'SALIDA' && entradaAbierta) {
      const t1 = new Date(entradaAbierta.timestamp ?? '').getTime();
      const t2 = new Date(marca.timestamp ?? '').getTime();
      if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
        totalHours += (t2 - t1) / 3_600_000;
        nightHours += nightHoursBetween(t1, t2);
      }
      entradaAbierta = null;
    }
  }

  return {
    totalHours: parseFloat(totalHours.toFixed(4)),
    nightHours: parseFloat(nightHours.toFixed(2)),
  };
};

/** Última marca ENTRADA/SALIDA del día (ignora marcas manuales). */
export const getUltimaMarcaRealtime = (marcas: Marca[] = []): Marca | null => {
  for (let i = marcas.length - 1; i >= 0; i--) {
    if (marcas[i].tipo === 'ENTRADA' || marcas[i].tipo === 'SALIDA') return marcas[i];
  }
  return null;
};

// ─── Resumen mensual ──────────────────────────────────────────────────────────

/**
 * Estadísticas del mes:
 * - Jornada ordinaria diaria base de 7.5 horas; las extras son el exceso diario.
 * - "Con Recargo" suma solo las horas de domingos y festivos.
 * - "Recargo Nocturno" suma las horas dentro de la franja nocturna vigente.
 * - Totales semanales por semana de calendario (lunes a domingo).
 */
export const calculateMonthlySummary = (entries: DayEntry[], year: number, month: number): MonthlySummary => {
  let totalHours = 0;
  let totalHoursWithRecargo = 0;
  let totalRecargoNocturno = 0;
  let totalHorasExtras = 0;
  let workedDays = 0;
  let maxDay: DayEntry | null = null;
  let minDay: DayEntry | null = null;

  const weekRanges = getWeekRangesOfMonth(year, month);
  const weeklyTotals = weekRanges.map(() => 0);

  entries.forEach((entry) => {
    if (entry.hours <= 0) return;

    workedDays++;
    totalHours += entry.hours;

    if (entry.hours > 7.5) totalHorasExtras += entry.hours - 7.5;
    if (entry.isHolidayOrSunday) totalHoursWithRecargo += entry.hours;
    if (entry.nightHours > 0) totalRecargoNocturno += entry.nightHours;

    const dia = startOfDay(entry.date).getDate();
    const semana = weekRanges.findIndex((w) => dia >= w.from && dia <= w.to);
    if (semana >= 0) weeklyTotals[semana] += entry.hours;

    if (!maxDay || entry.hours > maxDay.hours) maxDay = entry;
    if (!minDay || entry.hours < minDay.hours) minDay = entry;
  });

  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  const ultimoDia = `${ym}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    totalHours: round2(totalHours),
    totalHoursWithRecargo: round2(totalHoursWithRecargo),
    workedDays,
    averageHoursPerDay: workedDays > 0 ? round2(totalHours / workedDays) : 0,
    maxDay,
    minDay,
    weeklyTotals: weeklyTotals.map(round2),
    weekRanges,
    // El límite de cada semana es el vigente el día que la semana empieza
    weeklyLimits: weekRanges.map((w) => getColombianWeeklyLimit(`${ym}-${String(w.from).padStart(2, '0')}`)),
    weeklyLimit: getColombianWeeklyLimit(ultimoDia),
    totalRecargoNocturno: round2(totalRecargoNocturno),
    totalHorasExtras: round2(totalHorasExtras),
  };
};
