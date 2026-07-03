// context/WorkHoursContext.tsx
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
//@ts-ignore
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
  punchInRealTime: (tipoMarca: 'ENTRADA' | 'SALIDA', coords: any) => Promise<any>;
  globalSeconds: number;
  setGlobalSeconds: (seconds: number) => void;


}

export const WorkHoursContext = createContext<WorkHoursContextType | undefined>(undefined);

export const WorkHoursProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [globalSeconds, setGlobalSeconds] = useState(0);
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

    //@ts-ignore
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {

      setUser(currentUser);
      if (!currentUser) {
        setEntries({});
        setLoading(false);
      }
    });
    return unsubscribeAuth;
  }, []);


   // ⏱️ MOTOR DE TIEMPO ULTRA-POTENTE: Sincroniza y fuerza el conteo de segundos en vivo
  useEffect(() => {
    // 1. Forzamos la captura exacta del día de hoy en formato local AAAA-MM-DD
    const nowTime = new Date();
    const offsetMin = nowTime.getTimezoneOffset();
    const localDateObj = new Date(nowTime.getTime() - (offsetMin * 60 * 1000));
    const todayStr = localDateObj.toISOString().split('T')[0];
    
    const todayData = (entries as any)[todayStr] || null;
    const todayPunches = todayData?.marcas || [];
    
    let interval: any = null;

    if (todayPunches.length > 0) {
      const ultimaMarca = todayPunches[todayPunches.length - 1];
      
      // 🚨 CONTROL ESTRICTO: Si la última marca registrada en la nube es una ENTRADA
      if (ultimaMarca && ultimaMarca.tipo === 'ENTRADA') {
        
        const calcularSegundosMaster = () => {
          // Intentamos leer el timestamp digital de auditoría
          let startTimeMs = ultimaMarca.timestamp ? new Date(ultimaMarca.timestamp).getTime() : 0;
          
          // RESPALDO DE SEGURIDAD SENIOR: Si el timestamp no es válido o da NaN, calculamos usando la hora de la marca
          if (!startTimeMs || isNaN(startTimeMs)) {
            const [horaStr, periodo] = ultimaMarca.hora.split(' ');
            let [hrs, mins, secs] = horaStr.split(':').map(Number);
            if (isNaN(secs)) secs = 0;
            
            if (periodo && periodo.toLowerCase().includes('p') && hrs < 12) hrs += 12;
            if (periodo && periodo.toLowerCase().includes('a') && hrs === 12) hrs = 0;
            
            const baseDate = new Date();
            baseDate.setHours(hrs, mins, secs, 0);
            startTimeMs = baseDate.getTime();
          }

          const diffSegundos = Math.floor((Date.now() - startTimeMs) / 1000);
          
          // Forzamos al estado a tomar el conteo real en vivo (mínimo 1 segundo si está activo)
          setGlobalSeconds(diffSegundos > 0 ? diffSegundos : 1);
        };
        
        // Ejecutamos de inmediato e iniciamos el conteo en tiempo real
        calcularSegundosMaster();
        interval = setInterval(calcularSegundosMaster, 1000);
        
      } else {
        setGlobalSeconds(0); // Si ponchó salida, el reloj se apaga solo
      }
    } else {
      setGlobalSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [entries]);



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
          marcas: data.marcas || [],
        }as any;
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

    try {
      const { doc, getDoc, setDoc } = require('firebase/firestore');
      const docId = `${user.uid}_${entryData.date}`;
      const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      // 1. Consultamos el documento actual en Firebase para ver si el botón circular ya guardó marcas u horas reales
      const dayDocRef = doc(db, 'work_entries', docId);
      const dayDocSnap = await getDoc(dayDocRef);

      let marcasExistentes = [];
      let horasExistentes = 0;
      let startTimeExistente = entryData.startTime || '';
      let endTimeExistente = entryData.endTime || '';
      let locationExistente = entryData.location || null;

      if (dayDocSnap.exists()) {
        const dbData = dayDocSnap.data();
        marcasExistentes = dbData.marcas || [];
        horasExistentes = dbData.hours || 0;
        startTimeExistente = dbData.startTime || startTimeExistente;
        endTimeExistente = dbData.endTime || endTimeExistente;
        locationExistente = dbData.location || locationExistente;
      }

      // 2. DETECTOR DE ORIGEN: Si el modal no envía marcas nuevas ni horas manuales,
      // obligamos al sistema a retener y respetar las marcas y horas que ya calculó el botón gigante
      const marcasFinales = (entryData as any).marcas && (entryData as any).marcas.length > 0 
        ? (entryData as any).marcas 
        : marcasExistentes;

      let totalHours = horasExistentes;
      let nightHours = 0;

      // 3. Solo si el modal viene con horas manuales explícitas (el flujo viejo o el nuevo +hoy), calcula de forma tradicional
      if (entryData.startTime && entryData.endTime) {
        const { calculateHoursAndNightSplit } = require('../lib/utils'); // Ajusta la ruta a tu utils.ts si es necesario
        const splitResult = calculateHoursAndNightSplit(entryData.startTime, entryData.endTime);
        totalHours = splitResult.totalHours;
        nightHours = splitResult.nightHours;
      }

      // 4. Armamos el paquete unificado simétrico definitivo
      const payload = {
        userId: user.uid,
        yearMonth,
        date: entryData.date,
        startTime: startTimeExistente,
        endTime: endTimeExistente,
        hours: totalHours, // ⏱️ ¡BLINDADO! Retiene las horas del GPS real
        nightHours,
        isHolidayOrSunday: entryData.isHolidayOrSunday,
        notes: entryData.notes || null,
        location: locationExistente,
        marcas: marcasFinales // 🕒 ¡BLINDADO! Protege la lista de ponchadas en el calendario
      };

      // Guardamos fusionando datos de forma inteligente
      await setDoc(dayDocRef, payload, { merge: true });

      // Actualizamos tu estado de React en caliente para que el calendario se pinte al instante
      if (typeof setEntries === 'function') {
        setEntries((prev: any) => ({ ...prev, [entryData.date]: payload }));
      }

    } catch (error) {
      console.error("Error crítico en saveDayEntry:", error);
    }
  };


    // 🔘 FUNCIÓN MAESTRA: Poncha entrada/salida en tiempo real usando tu misma estructura exacta de Firestore
  const punchInRealTime = async (tipoMarca: 'ENTRADA' | 'SALIDA', coords: any) => {
    try {
      if (!user) return false;

      const { doc, getDoc, setDoc } = require('firebase/firestore');
      
      // 1. Capturamos la fecha de hoy exacta en formato de texto 'AAAA-MM-DD'
      //const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDate = new Date(now.getTime() - (offset * 60 * 1000));
      const todayStr = localDate.toISOString().split('T')[0];
      const horaStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      // 2. REPLICA DE RUTA: Tu misma fórmula exacta para armar el ID del archivo
      const docId = `${user.uid}_${todayStr}`;
      const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      // Apuntamos exactamente a tu colección 'work_entries' con tu docId
      const dayDocRef = doc(db, 'work_entries', docId);
      const dayDocSnap = await getDoc(dayDocRef);

      let marcasExistentes = [];
      let currentNotes = null;
      let currentIsHoliday = false;
      let currentStartTime = '';
      let currentEndTime = '';

      if (dayDocSnap.exists()) {
        const data = dayDocSnap.data();
        marcasExistentes = data.marcas || [];
        currentNotes = data.notes || null;
        currentIsHoliday = data.isHolidayOrSunday || false;
        currentStartTime = data.startTime || '';
        currentEndTime = data.endTime || '';
      }

      // 3. Creamos el nuevo sello digital de auditoría con la geolocalización
      const nuevaMarca = {
        id: `${tipoMarca.toLowerCase()}-${Date.now()}`,
        tipo: tipoMarca,
        hora: horaStr,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        accuracy: coords?.accuracy || null,
        timestamp: now.toISOString()
      };

      const listaActualizada = [...marcasExistentes, nuevaMarca];

      // 4. Calculadora automática de horas acumuladas en el día basándose en los tramos
      let totalHorasDia = 0;
      for (let i = 0; i < listaActualizada.length; i++) {
        if (listaActualizada[i].tipo === 'ENTRADA' && listaActualizada[i + 1]?.tipo === 'SALIDA') {
          const t1 = new Date(listaActualizada[i].timestamp).getTime();
          const t2 = new Date(listaActualizada[i + 1].timestamp).getTime();
          totalHorasDia += (t2 - t1) / (1000 * 60 * 60); // Convierte milisegundos a horas decimales
        }
      }

      // 5. Armamos el paquete unificado replicando todos tus campos nativos de la imagen
      const payload = {
        userId: user.uid,
        yearMonth,
        date: todayStr,
        startTime: currentStartTime,
        endTime: currentEndTime,
        hours: parseFloat(totalHorasDia.toFixed(2)),
        nightHours: 0, // El dashboard web se encargará de liquidar los recargos nocturnos
        isHolidayOrSunday: currentIsHoliday,
        notes: currentNotes,
        location: coords ? { latitude: coords.latitude, longitude: coords.longitude } : null,
        marcas: listaActualizada // Guardamos la lista de fracciones de jornada
      };

      // Guardamos aplicando merge: true para asegurar que sume sin pisar datos del modal
      await setDoc(dayDocRef, payload, { merge: true });

      // Actualizamos tu estado de React local para que el calendario se pinte de una vez en pantalla
      if (typeof setEntries === 'function') {
        setEntries((prev: any) => ({ ...prev, [todayStr]: payload }));
      }

      return { status: 'SUCCESS', estadoActual: tipoMarca === 'ENTRADA' ? 'LABORANDO' : 'FUERA' };

    } catch (error) {
      console.error("Error en el ponchador de tiempo real:", error);
      alert('No se pudo registrar la marca en la nube. Revisa tu red.');
      return false;
    }
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
    <WorkHoursContext.Provider value={{ entries, currentDate, summary, loading, user, goToPrevMonth, goToNextMonth, saveDayEntry, deleteDayEntry, exportCurrentMonthToCSV,punchInRealTime, globalSeconds, setGlobalSeconds  }}>
      {children}
    </WorkHoursContext.Provider>
  );
};

export const useWorkHours = () => {
  const context = useContext(WorkHoursContext);
  if (!context) throw new Error('useWorkHours debe usarse dentro de WorkHoursProvider');
  return context;
};
