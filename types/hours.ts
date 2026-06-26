// types/hours.ts

export interface DayEntry {
  date: string;               // Formato "YYYY-MM-DD"
  startTime: string;          // Hora de entrada "HH:MM"
  endTime: string;            // Hora de salida "HH:MM"
  hours: number;              // Total de horas reales calculadas en el día
  nightHours: number;         // Campo numérico dedicado para horas de la noche
  isHolidayOrSunday: boolean; // Identifica si aplica el recargo dominical/festivo
  notes?: string;   
  
  location?:{
    latitude: number;
    longitude: number;
    timestamp: number;// Anotaciones opcionales
    accuracy: number; 
  };
}

export interface MonthlySummary {
  totalHours: number;            // Suma de todas las horas netas trabajadas
  totalHoursWithRecargo: number; // EXCLUSIVO: Suma de horas equivalentes SOLO de domingos/festivos
  workedDays: number;            // Días con horas > 0
  averageHoursPerDay: number;    // Promedio por día trabajado
  maxDay: DayEntry | null;       // Jornada más larga
  minDay: DayEntry | null;       // Jornada más corta
  weeklyTotals: number[];        // Totales para el gráfico de barras SVG
  weeklyLimit: number;           // Límite legal semanal estándar (44 o 42)
  totalRecargoNocturno: number;  // EXCLUSIVO: Horas con recargo del +35% nocturno
  totalHorasExtras: number;      // EXCLUSIVO: Suma acumulada de excesos diarios > 7.5h
}
