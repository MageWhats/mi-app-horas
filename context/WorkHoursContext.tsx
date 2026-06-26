// context/WorkHoursContext.tsx
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth, db } from '../lib/firebase';
import { calculateMonthlySummary } from '../lib/utils';
import { DayEntry, MonthlySummary } from '../types/hours';

interface WorkHoursContextType {
  entries: Record<string, DayEntry>;
  currentDate: Date;
  summary: MonthlySummary;
  loading: boolean;
  user: User | null;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  saveDayEntry: (entryData: DayEntry) => Promise<void>;
  deleteDayEntry: (dateStr: string) => Promise<void>;
  exportCurrentMonthToCSV: () => Promise<void>;
}

const WorkHoursContext = createContext<WorkHoursContextType | undefined>(undefined);

export const WorkHoursProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
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
    weeklyTotals: [],
    weeklyLimit: 44,
    totalRecargoNocturno: 0,
    totalHorasExtras: 0,
  });

  // 1. ESCUCHA DE AUTENTICACIÓN: Detecta si hay un usuario activo
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setEntries({});
        setLoading(false);
      }
    });
    return unsubscribeAuth;
  }, []);

  // 2. ESCUCHA EN TIEMPO REAL DE FIRESTORE: Trae los datos de la nube de Google
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const q = query(
      collection(db, 'work_entries'),
      where('userId', '==', user.uid),
      where('yearMonth', '==', yearMonth)
    );

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const fetchedEntries: Record<string, DayEntry> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedEntries[data.date] = {
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          hours: data.hours,
          nightHours: data.nightHours,
          isHolidayOrSunday: data.isHolidayOrSunday,
          notes: data.notes,
          location: data.location, // Aquí cargamos las coordenadas GPS guardadas
        };
      });
      setEntries(fetchedEntries);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando Firestore: ", error);
      setLoading(false);
    });

    return unsubscribeSnapshot;
  }, [user, currentDate]);

  // 3. RE-CALCULAR ESTADÍSTICAS AUTOMÁTICAS
  useEffect(() => {
    const entriesArray = Object.values(entries);
    const updatedSummary = calculateMonthlySummary(entriesArray);
    setSummary(updatedSummary);
  }, [entries]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // 4. GUARDAR EN LA NUBE REAL DE FIRESTORE CON GPS
  const saveDayEntry = async (entryData: DayEntry) => {
    if (!user) return;
    const { calculateHoursAndNightSplit } = require('../lib/utils');
    const { totalHours, nightHours } = calculateHoursAndNightSplit(entryData.startTime, entryData.endTime);
    const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const docId = `${user.uid}_${entryData.date}`;

    await setDoc(doc(db, 'work_entries', docId), {
      userId: user.uid,
      yearMonth,
      date: entryData.date,
      startTime: entryData.startTime,
      endTime: entryData.endTime,
      hours: totalHours,
      nightHours: nightHours,
      isHolidayOrSunday: entryData.isHolidayOrSunday,
      notes: entryData.notes || null,
      location: entryData.location || null, // Guardamos la latitud y longitud en Firebase
    });
  };

  // 5. ELIMINAR JORNADA DE LA NUBE
  const deleteDayEntry = async (dateStr: string) => {
    if (!user) return;
    const docId = `${user.uid}_${dateStr}`;
    await deleteDoc(doc(db, 'work_entries', docId));
  };

  // 6. EXPORTACIÓN A EXCEL EN DOS PESTAÑAS
  const exportCurrentMonthToCSV = async () => {
    const XLSX = require('xlsx');
    const monthsLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonthLabel = monthsLabels[currentDate.getMonth()];
    const filename = `Reporte_Horas_${currentDate.getFullYear()}_${currentDate.getMonth() + 1}.xlsx`;

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

    const summaryData = [
      { 'MÉTRICA LABORAL': 'Horas Reales Totales', 'VALOR': `${summary.totalHours}h`, 'DESCRIPCIÓN': 'Tiempo neto acumulado' },
      { 'MÉTRICA LABORAL': 'Horas con Recargo', 'VALOR': `${summary.totalHoursWithRecargo}h`, 'DESCRIPCIÓN': 'Total en Dominicales / Festivos' },
      { 'MÉTRICA LABORAL': 'Días Activos', 'VALOR': summary.workedDays, 'DESCRIPCIÓN': 'Jornadas registradas' },
      { 'MÉTRICA LABORAL': 'Promedio Diario', 'VALOR': `${summary.averageHoursPerDay}h`, 'DESCRIPCIÓN': 'Media por jornada' },
      { 'MÉTRICA LABORAL': 'Recargo Nocturno', 'VALOR': `${summary.totalRecargoNocturno}h`, 'DESCRIPCIÓN': 'Horas físicas nocturnas' },
      { 'MÉTRICA LABORAL': 'Horas Extras Acumuladas', 'VALOR': `${summary.totalHorasExtras}h`, 'DESCRIPCIÓN': 'Suma de excesos > 7.5h' },
      { 'MÉTRICA LABORAL': 'Límite Semanal Legal', 'VALOR': `${summary.weeklyLimit}h`, 'DESCRIPCIÓN': 'Tope semanal en Colombia' }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, `Resumen ${currentMonthLabel}`);

    if (Platform.OS === 'web') {
      XLSX.writeFile(workbook, filename);
    }
  };

  return (
    <WorkHoursContext.Provider value={{ entries, currentDate, summary, loading, user, goToPrevMonth, goToNextMonth, saveDayEntry, deleteDayEntry, exportCurrentMonthToCSV }}>
      {children}
    </WorkHoursContext.Provider>
  );
};

export const useWorkHours = () => {
  const context = useContext(WorkHoursContext);
  if (!context) throw new Error('useWorkHours debe usarse dentro de WorkHoursProvider');
  return context;
};
