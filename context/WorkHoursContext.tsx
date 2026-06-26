// context/WorkHoursContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { calculateMonthlySummary } from '../lib/utils';
import { DayEntry, MonthlySummary } from '../types/hours';


interface WorkHoursContextType {
  entries: Record<string, DayEntry>;    // Diccionario del mes activo { "YYYY-MM-DD": DayEntry }
  currentDate: Date;                     // Fecha de control para el mes activo
  summary: MonthlySummary;               // Estadísticas precalculadas del mes
  loading: boolean;
  saveDayEntry: (entry: Omit<DayEntry, 'hours'>) => Promise<void>;
  deleteDayEntry: (dateStr: string) => Promise<void>;
  goToNextMonth: () => void;
  goToPrevMonth: () => void;
  exportCurrentMonthToCSV: () => Promise<void>;
}

const WorkHoursContext = createContext<WorkHoursContextType | undefined>(undefined);

export const WorkHoursProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
   const [summary, setSummary] = useState<MonthlySummary>({
    totalHours: 0,
    totalHoursWithRecargo: 0,
    workedDays: 0,
    averageHoursPerDay: 0,
    maxDay: null,
    minDay: null,
    weeklyTotals: [0, 0, 0, 0, 0],
    weeklyLimit: 44,              // Valor inicial por defecto (Ley Col.)
    totalRecargoNocturno: 0,      // Valor inicial por defecto
    totalHorasExtras: 0,          // Valor inicial por defecto
  });


  // Genera la clave única por bloque mensual (Ej: "@work_hours_2026_06")
  const getStorageKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `@work_hours_${year}_${month}`;
  };

  // 1. CARGA DINÁMICA DE BLOQUE MENSUAL
  useEffect(() => {
    const loadMonthData = async () => {
      setLoading(true);
      try {
        const key = getStorageKey(currentDate);
        const savedData = await AsyncStorage.getItem(key);
        if (savedData) {
          const parsed = JSON.parse(savedData) as Record<string, DayEntry>;
          setEntries(parsed);
        } else {
          setEntries({});
        }
      } catch (error) {
        console.error("Error cargando bloque mensual:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMonthData();
  }, [currentDate]);

  // 2. RECALCULAR ESTADÍSTICAS AUTOMÁTICAMENTE CUANDO CAMBIAN LOS DATOS
  useEffect(() => {
    const entriesArray = Object.values(entries);
    const updatedSummary = calculateMonthlySummary(entriesArray);
    setSummary(updatedSummary);
  }, [entries]);

 // 3. OPERACIÓN GUARDAR / EDITAR (CRUD)
  const saveDayEntry = async (entryData: Omit<DayEntry, 'hours' | 'nightHours'>) => {
    const { calculateHoursAndNightSplit } = require('../lib/utils');
    
    // El algoritmo automatizado calcula ambos valores en base al rango ingresado
    const { totalHours, nightHours } = calculateHoursAndNightSplit(entryData.startTime, entryData.endTime);

    const updatedEntries = { ...entries };
    
    updatedEntries[entryData.date] = {
      ...entryData,
      hours: totalHours,
      nightHours: nightHours
    };

    setEntries(updatedEntries);
    const key = getStorageKey(currentDate);
    await AsyncStorage.setItem(key, JSON.stringify(updatedEntries));
  };


  // 4. OPERACIÓN ELIMINAR (CRUD)
  const deleteDayEntry = async (dateStr: string) => {
    const updatedEntries = { ...entries };
    delete updatedEntries[dateStr];
    
    setEntries(updatedEntries);
    const key = getStorageKey(currentDate);
    await AsyncStorage.setItem(key, JSON.stringify(updatedEntries));
  };

  // 5. NAVEGACIÓN TEMPORAL DE MESES
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // 6. EXPORTACIÓN DE HOJA EXCEL REAL CON DOS PESTAÑAS (DETALLE + RESUMEN ESPIEJO)
  const exportCurrentMonthToCSV = async () => {
    const XLSX = require('xlsx'); // Importación en caliente para entorno web
    
    const monthsLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonthLabel = monthsLabels[currentDate.getMonth()];
    const labelLabel = `${currentMonthLabel} ${currentDate.getFullYear()}`;
    const filename = `Reporte_Horas_${currentDate.getFullYear()}_${currentDate.getMonth() + 1}.xlsx`;

    // --- HOJA 1: DETALLE DIARIO ---
    const detailRows = Object.values(entries).map((entry) => {
      const extraDiaria = entry.hours > 7.5 ? entry.hours - 7.5 : 0;
      return {
        'FECHA': entry.date,
        'HORA ENTRADA': entry.startTime,
        'HORA SALIDA': entry.endTime,
        'HORAS REALES': `${entry.hours}h`,
        'HORAS NOCTURNAS': `${entry.nightHours}h`,
        'HORAS EXTRAS (T. 7.5h)': `${extraDiaria.toFixed(1)}h`,
        '¿FESTIVO / DOMINGO?': entry.isHolidayOrSunday ? 'SÍ' : 'NO',
        'NOTAS / NOVEDADES': entry.notes || 'Sin novedades'
      };
    });

    const workbook = XLSX.utils.book_new();
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalle Diario");

    // --- HOJA 2: RESUMEN MENSUAL (REFLEJO DE LAS 6 TARJETAS) ---
    const summaryData = [
      { 'MÉTRICA LABORAL': 'Horas Reales Totales', 'VALOR': `${summary.totalHours}h`, 'DESCRIPCIÓN': 'Tiempo neto acumulado trabajado en el mes' },
      { 'MÉTRICA LABORAL': 'Horas con Recargo', 'VALOR': `${summary.totalHoursWithRecargo}h`, 'DESCRIPCIÓN': 'Total de horas físicas laboradas en Domingos / Festivos' },
      { 'MÉTRICA LABORAL': 'Días Activos', 'VALOR': summary.workedDays, 'DESCRIPCIÓN': 'Cantidad de jornadas registradas en este período' },
      { 'MÉTRICA LABORAL': 'Promedio Diario', 'VALOR': `${summary.averageHoursPerDay}h`, 'DESCRIPCIÓN': 'Media de tiempo laborado por jornada' },
      { 'MÉTRICA LABORAL': 'Recargo Nocturno', 'VALOR': `${summary.totalRecargoNocturno}h`, 'DESCRIPCIÓN': 'Total de horas físicas laboradas en horario nocturno' },
      { 'MÉTRICA LABORAL': 'Horas Extras Acumuladas', 'VALOR': `${summary.totalHorasExtras}h`, 'DESCRIPCIÓN': 'Suma de excesos diarios superiores a las 7.5h base' },
      { 'MÉTRICA LABORAL': 'Límite Semanal Legal', 'VALOR': `${summary.weeklyLimit}h`, 'DESCRIPCIÓN': 'Tope máximo ordinario semanal según Ley de Colombia' }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 45 }]; // Ancho óptimo para las columnas del resumen
    XLSX.utils.book_append_sheet(workbook, summarySheet, `Resumen ${currentMonthLabel}`);

    // 3. Generamos el archivo binario descargable y lo disparamos en el navegador
    if (Platform.OS === 'web') {
      XLSX.writeFile(workbook, filename);
    }
  };




  return (
    <WorkHoursContext.Provider value={{
      entries,
      currentDate,
      summary,
      loading,
      saveDayEntry,
      deleteDayEntry,
      goToNextMonth,
      goToPrevMonth,
      exportCurrentMonthToCSV
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
