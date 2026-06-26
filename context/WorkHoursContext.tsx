// context/WorkHoursContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { calculateMonthlySummary, convertEntriesToCSV } from '../lib/utils';
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

  // 6. EXPORTACIÓN NATIVA A EXCEL (CSV)
  const exportCurrentMonthToCSV = async () => {
    const entriesArray = Object.values(entries);
    if (entriesArray.length === 0) {
      Alert.alert("Sin registros", "No tienes datos guardados en este mes para exportar.");
      return;
    }

    // Ordena los registros por fecha antes de compilar el CSV
    const sortedEntries = entriesArray.sort((a, b) => a.date.localeCompare(b.date));
    const label = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const csvContent = convertEntriesToCSV(sortedEntries, label);

    try {
      const filename = `Reporte_Horas_${label}.csv`;
      const fileUri = String(FileSystem.documentDirectory) + filename;



      
      // Escribe el archivo temporal en el sistema de archivos del celular
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // Abre el menú nativo para compartir (WhatsApp, Correo, Guardar en Archivos)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Exportar horas de ${label}`,
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert("Error", "La función de compartir no está disponible en este dispositivo.");
      }
    } catch (error) {
      console.error("Error exportando CSV:", error);
      Alert.alert("Error", "Ocurrió un fallo al intentar generar el archivo.");
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
