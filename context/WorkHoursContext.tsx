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
    // Línea 187: Extraemos el año y mes de la fecha que el operario seleccionó en el formulario
    const [year, month] = entryData.date.split('-');
    const currentYearMonth = `${year}-${month}`; // Ej: '2026-07'

    // Línea 191: Apuntamos al documento único mensual de 'work_months'
    const monthDocRef = doc(db, 'work_months', `${user.uid}_${currentYearMonth}`);
    const dayDocSnap = await getDoc(monthDocRef); // Cambiado dayDocRef por monthDocRef


      let marcasExistentes = [];
      let horasExistentes = 0;
      let startTimeExistente = entryData.startTime || '';
      let endTimeExistente = entryData.endTime || '';
      let locationExistente = entryData.location || null;

    if (dayDocSnap.exists()) {
      const data = dayDocSnap.data();
      const diasMap = data.dias || {};
      const dbData = diasMap[entryData.date] || {}; // Buscamos la fecha seleccionada

      marcasExistentes = dbData.marcas || [];
      horasExistentes = dbData.totalHours || 0; // Cambiado .hours por .totalHours
      startTimeExistente = dbData.startTime || startTimeExistente;
      endTimeExistente = dbData.endTime || endTimeExistente;
      locationExistente = dbData.location || locationExistente;
    }


     
    // 2. DETECTOR DE ORIGEN: Evaluamos si el formulario envía horas explícitas
    let marcasFinales = marcasExistentes;
    
    if (entryData.startTime && entryData.endTime) {
      const horaLegible = `${entryData.startTime} - ${entryData.endTime}`;
      marcasFinales = [
        {
          id: `manual-${Date.now()}`,
          tipo: 'MANUAL',
          horaIngreso: entryData.startTime.trim(), // 🛡️ ¡Sueltas y separadas por fin!
          horaSalida: entryData.endTime.trim(),   // 🛡️ ¡Sueltas y separadas por fin!
          hora: horaLegible, // Respaldamos el texto completo para no romper la visual actual
          zona: 'Registro Manual'
        }
      ];
    } else if ((entryData as any).marcas && (entryData as any).marcas.length > 0) {
      marcasFinales = (entryData as any).marcas;
    }


      let totalHours = horasExistentes;
      let nightHours = 0;

      // // 3. Solo si el modal viene con horas manuales explícitas (Línea 219)
    if (entryData.startTime && entryData.endTime) {
    // 🛡️ PROCESADOR UNIVERSAL COLOMBIANO: Convierte Web (24h) o Android (AM/PM) a minutos del día
    const normalizarAMinutos = (horaTexto: string) => {
      let texto = horaTexto.toLowerCase().replace(/\./g, '').trim(); // Quita puntos: "a. m." -> "am"
      let esPM = texto.includes('pm') || texto.includes('p m');
      let esAM = texto.includes('am') || texto.includes('a m');
      
      let soloNumeros = texto.replace(/(am|pm|a\s*m|p\s*m)/g, '').trim();
      const [hrsStr, minsStr] = soloNumeros.split(':');
      
      let horas = parseInt(hrsStr, 10) || 0;
      let minutos = parseInt(minsStr, 10) || 0;
      
      if (!esPM && !esAM) {
        return horas * 60 + minutos; // Si ya viene en formato 24h desde la Web
      }
      
      if (esPM && horas < 12) horas += 12;
      if (esAM && horas === 12) horas = 0;
      
      return horas * 60 + minutos;
    };

    try {
      const minInicio = normalizarAMinutos(entryData.startTime);
      const minFin = normalizarAMinutos(entryData.endTime);
      
      let diffMinutos = minFin - minInicio;
      if (diffMinutos < 0) diffMinutos += 24 * 60; // Control por si cruza la medianoche
      
      totalHours = parseFloat((diffMinutos / 60).toFixed(2));

      // 🧮 LIQUIDADOR DE RECARGOS NOCTURNOS (9:00 p. m. a 6:00 a. m. -> 1260 min a 360 min)
      let conteoNocturnoMin = 0;
      let momentoActual = minInicio;

      for (let m = 0; m < diffMinutos; m++) {
        let minutoDelDia = momentoActual % (24 * 60);
        if (minutoDelDia >= 1260 || minutoDelDia < 360) {
          conteoNocturnoMin++;
        }
        momentoActual++;
      }
      
      nightHours = parseFloat((conteoNocturnoMin / 60).toFixed(2));

    } catch (err) {
      console.error("Error en cálculo manual unificado:", err);
      const { calculateHoursAndNightSplit } = require('../lib/utils');
      const splitResult = calculateHoursAndNightSplit(entryData.startTime, entryData.endTime);
      totalHours = splitResult.totalHours;
      nightHours = splitResult.nightHours;
    }

    }

    // 4. Armamos la estructura del día actual indexada para el mapa mensual
    const diaEstructurado = {
      date: entryData.date,
      totalHours: totalHours, // El valor matemático que procesó tu limpiador de arriba
      nightHours: nightHours > 0 ? nightHours : 0,
      isHolidayOrSunday: entryData.isHolidayOrSunday,
      notes: entryData.notes || null,
      marcas: marcasFinales
    };

    // Descargamos el mapa total actual de la nube para fusionar el día de forma segura
    let mapaDiasFinal = {};
    if (dayDocSnap.exists()) {
      mapaDiasFinal = dayDocSnap.data().dias || {};
    }
    // Añadimos o pisamos el día editado en el mapa de memoria
    //@ts-ignore
    mapaDiasFinal[entryData.date] = diaEstructurado;

    // Guardamos aplicando merge: true en la nueva colección 'work_months'
    await setDoc(monthDocRef, {
      userId: user.uid,
      yearMonth: currentYearMonth,
      updatedAt: new Date().toISOString(),
      dias: mapaDiasFinal
    }, { merge: true });

    // Actualizamos tu estado de React en caliente para pintar el calendario al instante
    if (typeof setEntries === 'function') {
      setEntries(mapaDiasFinal);
    }
     }catch (error) {
      console.error("Error crítico en saveDayEntry:", error);
    }
  };


    // 🔘 FUNCIÓN MAESTRA: Poncha entrada/salida en tiempo real usando tu misma estructura exacta de Firestore
  const punchInRealTime = async (tipoMarca: 'ENTRADA' | 'SALIDA', coords: any) => {
    try {
      if (!user) return false;

      const { doc, getDoc, setDoc } = require('firebase/firestore');
      
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDate = new Date(now.getTime() - (offset * 60 * 1000));
      const todayStr = localDate.toISOString().split('T')[0];
      const horaStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      const [year, month] = todayStr.split('-');
      const currentYearMonth = `${year}-${month}`; 

      const monthDocRef = doc(db, 'work_months', `${user.uid}_${currentYearMonth}`);
      const dayDocSnap = await getDoc(monthDocRef); // Cambiado dayDocRef por monthDocRef

    let marcasExistentes: any[] = [];
    let currentNotes: string | null = null;
    let currentIsHoliday = false;
    let currentHours = 0;

    if (dayDocSnap.exists()) {
      const data = dayDocSnap.data();
      const diasMap = data.dias || {};
      
      // 🛡️ REPARACIÓN QUIRÚRGICA: Si el día ya tiene datos, extraemos la info real con un respaldo limpio
      if (diasMap && diasMap[todayStr]) {
        const dayDataExistente = diasMap[todayStr];
        marcasExistentes = Array.isArray(dayDataExistente.marcas) ? dayDataExistente.marcas : [];
        currentNotes = dayDataExistente.notes || null;
        currentIsHoliday = dayDataExistente.isHolidayOrSunday || false;
        currentHours = dayDataExistente.totalHours || dayDataExistente.hours || 0;
      }
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
      for (let i = 0; i < listaActualizada.length; i += 2) {

        if (listaActualizada[i].tipo === 'ENTRADA' && listaActualizada[i + 1]?.tipo === 'SALIDA') {
          const t1 = new Date(listaActualizada[i].timestamp).getTime();
          const t2 = new Date(listaActualizada[i + 1].timestamp).getTime();
          totalHorasDia += (t2 - t1) / (1000 * 60 * 60); // Convierte milisegundos a horas decimales
        }
      } 
          // 5. Armamos la estructura del día actual para indexarla en el mapa
      const diaEstructurado = {
      date: todayStr,
      totalHours: parseFloat(totalHorasDia.toFixed(4)), // Conserva precisión de segundos
      nightHours: 0,
      isHolidayOrSunday: currentIsHoliday,
      notes: currentNotes,
      marcas: listaActualizada
      };

      // Obtenemos el mapa existente del documento para hacer el merge de forma segura por software
      let mapaDiasFinal = {};
      if (dayDocSnap.exists()) {
      mapaDiasFinal = dayDocSnap.data().dias || {};
      }
      // Inyectamos o actualizamos el día de hoy dentro del mapa global
      //@ts-ignore
      mapaDiasFinal[todayStr] = diaEstructurado;

      // Guardamos aplicando merge: true en la colección principal 'work_months'
      await setDoc(monthDocRef, {
      userId: user.uid,
      yearMonth: currentYearMonth,
      updatedAt: now.toISOString(),
      dias: mapaDiasFinal
      }, { merge: true });

      // Actualizamos tu estado de React local para que el calendario se pinte de una vez
      if (typeof setEntries === 'function') {
        setEntries(mapaDiasFinal); // Pasamos el mapa completo de días al calendario
      }
    } catch (error) { // 🛡️ ¡AQUÍ! Esta es la llave '}' que faltaba para cerrar el try de arriba
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
