// types/hours.ts

export type TipoMarca = 'ENTRADA' | 'SALIDA' | 'MANUAL' | 'MANUAL_JORNADA';

export interface Marca {
  id: string;
  tipo: TipoMarca;
  hora: string;               // Texto legible para la interfaz
  timestamp?: string;         // ISO; presente en las marcas en tiempo real
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  motivoSinGps?: string;      // Justificación cuando se registró sin ubicación
  ubicacionSimulada?: boolean; // Android reportó una app de GPS falso
  corteMedianoche?: boolean;  // Generada al partir un turno nocturno a las 00:00
  sinConexion?: boolean;      // Registrada sin señal: la hora es la del celular (validada por el servidor)
  pendiente?: boolean;        // Guardada en el celular, aún sin enviar
  anulada?: boolean;          // Registro manual anulado: no suma horas
  motivoAnulacion?: string;
  horaIngreso?: string;       // Solo marcas MANUAL (HH:MM, 24 h)
  horaSalida?: string;        // Solo marcas MANUAL (HH:MM, 24 h)
  totalHours?: number;        // Solo marcas MANUAL_JORNADA
  zona?: string;
}

export interface DayEntry {
  date: string;               // Formato "YYYY-MM-DD"
  hours: number;              // Total de horas del día (calculado a partir de las marcas)
  nightHours: number;         // Horas dentro de la franja nocturna (21:00 - 06:00)
  isHolidayOrSunday: boolean; // Domingo o festivo oficial: aplica recargo (calculado, no editable)
  notes?: string | null;
  marcas?: Marca[];
}

/** Rango de días del mes (inclusive) que forma una semana de calendario. */
export interface WeekRange {
  from: number;
  to: number;
}

export interface MonthlySummary {
  totalHours: number;            // Suma de todas las horas netas trabajadas
  totalHoursWithRecargo: number; // Horas trabajadas en domingos/festivos
  workedDays: number;            // Días con horas > 0
  averageHoursPerDay: number;    // Promedio por día trabajado
  maxDay: DayEntry | null;       // Jornada más larga
  minDay: DayEntry | null;       // Jornada más corta
  weeklyTotals: number[];        // Totales por semana de calendario (lunes a domingo)
  weekRanges: WeekRange[];       // Días que abarca cada semana dentro del mes
  weeklyLimits: number[];        // Límite legal de cada semana
  weeklyLimit: number;           // Límite legal semanal vigente al cierre del mes
  totalRecargoNocturno: number;  // Horas en la franja nocturna
  totalHorasExtras: number;      // Suma de excesos diarios > 7.5h
}
