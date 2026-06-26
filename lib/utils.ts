// lib/utils.ts
import { DayEntry, MonthlySummary } from '../types/hours';

/**
 * Calcula el total de horas reales trabajadas y, de forma automática,
 * cuántas de esas horas corresponden a la jornada nocturna en Colombia (21:00 a 06:00).
 * Maneja de forma nativa jornadas cruzadas de medianoche.
 */
export const calculateHoursAndNightSplit = (startTime: string, endTime: string): { totalHours: number; nightHours: number } => {
  if (!startTime || !endTime) return { totalHours: 0, nightHours: 0 };

  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);

  let startTotalMinutes = startHours * 60 + startMinutes;
  let endTotalMinutes = endHours * 60 + endMinutes;

  // Si la hora de salida es menor a la de entrada, significa que cruzó la medianoche
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  let totalWorkedMinutes = endTotalMinutes - startTotalMinutes;
  let nightMinutes = 0;

  // Evaluamos minuto a minuto la jornada para ver cuáles caen en el rango nocturno (21:00 a 06:00)
  for (let m = startTotalMinutes; m < endTotalMinutes; m++) {
    const currentMinuteOfDay = m % (24 * 60); // Normaliza el minuto dentro de las 24 horas del día
    
    const nuevePM = 21 * 60; // 1260 minutos
    const seisAM = 6 * 60;   // 360 minutos

    // Un minuto es nocturno si es mayor o igual a las 9 PM O menor que las 6 AM
    if (currentMinuteOfDay >= nuevePM || currentMinuteOfDay < seisAM) {
      nightMinutes++;
    }
  }

  return {
    totalHours: Math.round((totalWorkedMinutes / 60) * 100) / 100,
    nightHours: Math.round((nightMinutes / 60) * 100) / 100
  };
};

/**
 * Función de compatibilidad requerida por el empaquetador para diferencias planas
 */
export const calculateHoursDifference = (startTime: string, endTime: string): number => {
  return calculateHoursAndNightSplit(startTime, endTime).totalHours;
};

const getWeekOfMonthIndex = (dateStr: string): number => {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfMonth = date.getDate();
  return Math.min(Math.floor((dayOfMonth - 1) / 7), 4); 
};

export const getColombianWeeklyLimit = (dateStr: string): number => {
  const date = new Date(dateStr + 'T00:00:00');
  const year = date.getFullYear();
  const month = date.getMonth();

  if (year > 2026) return 42;
  if (year < 2026) return 44;

  if (month === 6) { // Julio de 2026
    return date.getDate() >= 15 ? 42 : 44;
  }
  return month > 6 ? 42 : 44;
};

/**
 * Procesa las estadísticas del mes aplicando las reglas de tu contrato:
 * - Jornada ordinaria diaria base de 7.5 horas.
 * - Extras calculadas por exceso diario de las 7.5 horas.
 * - Tarjeta "Con Recargo" exclusiva para horas en Domingos y Festivos.
 * - Tarjeta "Recargo Nocturno" exclusiva para el recargo del +35% automático.
 */
export const calculateMonthlySummary = (entries: DayEntry[]): MonthlySummary => {
  let totalHours = 0;
  let totalHoursWithRecargo = 0; 
  let totalRecargoNocturno = 0;  
  let totalHorasExtras = 0;      
  let workedDays = 0;
  let maxDay: DayEntry | null = null;
  let minDay: DayEntry | null = null;
  
  const weeklyTotals = [0, 0, 0, 0, 0]; // 5 semanas en un mes

  entries.forEach((entry) => {
    if (entry.hours > 0) {
      workedDays++;
      totalHours += entry.hours;

      // 1. CÁLCULO DIARIO DE HORAS EXTRAS: Si supera las 7.5 horas base del contrato
      if (entry.hours > 7.5) {
        totalHorasExtras += (entry.hours - 7.5);
      }

      // 2. TARJETA CON RECARGO EXCLUSIVA: Solo domingos / festivos con el +75% legal (x1.75)
      if (entry.isHolidayOrSunday) {
        totalHoursWithRecargo += entry.hours;
      }

      // 3. TARJETA RECARGO NOCTURNO AUTOMÁTICA: Aplica el +35% (x0.35) sobre el split calculado
      if (entry.nightHours > 0) {
        totalRecargoNocturno += entry.nightHours;
      }

      const weekIndex = getWeekOfMonthIndex(entry.date);
      if (weekIndex >= 0 && weekIndex < weeklyTotals.length) {
        weeklyTotals[weekIndex] += entry.hours;
      }

      if (!maxDay || entry.hours > maxDay.hours) maxDay = entry;
      if (!minDay || entry.hours < minDay.hours) minDay = entry;
    }
  });

  const referenceDate = entries.length > 0 ? entries[0].date : '2026-06-01';
  const weeklyLimit = getColombianWeeklyLimit(referenceDate);
  const averageHoursPerDay = workedDays > 0 ? Math.round((totalHours / workedDays) * 100) / 100 : 0;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalHoursWithRecargo: Math.round(totalHoursWithRecargo * 100) / 100,
    workedDays,
    averageHoursPerDay,
    maxDay,
    minDay,
    weeklyTotals: weeklyTotals.map(h => Math.round(h * 100) / 100),
    weeklyLimit,
    totalRecargoNocturno: Math.round(totalRecargoNocturno * 100) / 100,
    totalHorasExtras: Math.round(totalHorasExtras * 100) / 100
  };
};

// lib/utils.ts (Sección Final)

/**
 * Convierte el listado de días registrados en un archivo de texto CSV compatible con Microsoft Excel.
 * Estructura alineada al contrato de 7.5h diarias y cálculo nocturno automático.
 */
export const convertEntriesToCSV = (entries: DayEntry[], yearMonthLabel: string): string => {
  // 1. Definimos los encabezados de las columnas en español y mayúsculas para Excel
  const headers = [
    'FECHA', 
    'HORA ENTRADA', 
    'HORA SALIDA', 
    'HORAS REALES', 
    'HORAS NOCTURNAS', 
    'HORAS EXTRAS (T. 7.5h)', 
    '¿FESTIVO / DOMINGO?', 
    'NOTAS / NOVEDADES'
  ];
  
  // 2. Mapeamos cada uno de los días guardados por el usuario
  const rows = entries.map((entry) => {
    // Calculamos el exceso exacto sobre las 7.5h diarias para la columna de extras
    const extraDiaria = entry.hours > 7.5 ? entry.hours - 7.5 : 0;
    
    // Limpiamos los saltos de línea o comas en las notas para no romper las celdas de Excel
    const cleanNotes = entry.notes 
      ? entry.notes.replace(/,/g, ';').replace(/\n/g, ' ') 
      : 'Sin novedades';
    
    return [
      entry.date,
      entry.startTime,
      entry.endTime,
      `${entry.hours}h`,
      `${entry.nightHours}h`,
      `${extraDiaria.toFixed(1)}h`,
      entry.isHolidayOrSunday ? 'SÍ' : 'NO',
      `"${cleanNotes}"`
    ].join(','); // Separa cada celda por una coma estándar
  });

  // 3. Unimos el título del reporte, los encabezados y todas las filas con saltos de línea
  return [
    `REPORTE MENSUAL DE HORAS TRABAJADAS - ${yearMonthLabel.toUpperCase()}`,
    '', // Fila vacía de separación estética
    headers.join(','),
    ...rows
  ].join('\n');
};
