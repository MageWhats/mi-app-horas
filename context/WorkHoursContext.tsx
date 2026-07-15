// context/WorkHoursContext.tsx
import ExcelJS from 'exceljs';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { User } from 'firebase/auth';
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
  userRole: 'admin' | 'employee' | null;
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
  const [userRole, setUserRole] = useState<'admin' | 'employee' | null>(null);
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

  // 🔐 ESCUDO DE AUTENTICACIÓN Y ROLES: Monitorea la sesión y el tipo de cuenta en Firestore
  useEffect(() => {
    const { onAuthStateChanged } = require('firebase/auth');
    const { collection, query, where, getDocs } = require('firebase/firestore');

    //@ts-ignore
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          // 🛡️ BÚSQUEDA GERENCIAL POR CAMPO INTERNO: Localiza el documento usando la propiedad uid
          const q = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Tomamos el primer documento coincidente de la lista
            const userDocDoc = querySnapshot.docs[0];
            const userData = userDocDoc.data();

            // Guardamos el rol real ('admin' o 'employee')
            setUserRole(userData.role || 'employee');
          } else {
            setUserRole('employee'); // Respaldo si no encuentra ninguna cédula con ese UID
          }
        } catch (error) {
          console.error("Error al obtener el rol del usuario desde Firestore:", error);
          setUserRole('employee');
        }

      } else {
        setUser(null);
        setUserRole(null); // Limpieza absoluta al cerrar sesión
        setEntries({});
      }
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribeAuth === 'function') unsubscribeAuth();
    };
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
  // // 2. ESCUCHA EN TIEMPO REAL DESDE LA COLECCIÓN UNIFICADA 'work_months'
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Calculamos el año y mes en formato AAAA-MM (Ej: "2026-07")
    const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // Apuntamos al documento del mes en curso para el usuario autenticado
    const q = query(
      collection(db, 'work_months'),
      where('userId', '==', user.uid),
      where('yearMonth', '==', yearMonth)
    );

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      let fetchedEntries: Record<string, any> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Si el documento contiene el mapa global de días, lo procesamos
        if (data.dias) {
          Object.keys(data.dias).forEach((fechaKey) => {
            const diaData = data.dias[fechaKey];

            // 🔥 HOMOLOGACIÓN DE SEGURIDAD:
            // Si en la base de datos se llama 'totalHours', le creamos la propiedad 'hours' 
            // para que tu Excel y tus pantallas sigan leyendo sin romper nada.
            fetchedEntries[fechaKey] = {
              ...diaData,
              hours: diaData.hours !== undefined ? diaData.hours : (diaData.totalHours || 0)
            };
          });
        }
      });

      // Inyectamos el mapa consolidado al estado local para pintar el calendario de una vez
      setEntries(fetchedEntries);
      setLoading(false);
    }, (error) => {
      console.error("Error en la escucha en tiempo real de work_months:", error);
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
        // 🚀 PONLO AQUÍ (FUERA DEL CATCH):
        console.log("=== DEBUG JORNADA MANUAL ===");
        console.log("Total horas finales que van a subirse:", totalHours);
        console.log("Horas nocturnas finales que van a subirse:", nightHours);
        console.log("=============================");

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

      // // Actualizamos tu estado de React en caliente mapeando los tipos de forma segura
      if (typeof setEntries === 'function') {
        const mapaHomologado: Record<string, any> = {};

        // Recorremos cada día del mapa para asegurarnos de que la interfaz reciba números limpios
        Object.keys(mapaDiasFinal).forEach((fechaKey) => {
          //@ts-ignore
          const diaOriginal = mapaDiasFinal[fechaKey];

          mapaHomologado[fechaKey] = {
            ...diaOriginal,
            // 🔥 1. Forzamos la propiedad 'hours' convirtiendo cualquier string de toFixed a número real
            hours: diaOriginal.hours !== undefined
              ? Number(diaOriginal.hours)
              : Number(diaOriginal.totalHours || 0),

            // 🔥 2. Aseguramos que los recargos nocturnos también viajen como números puros
            nightHours: Number(diaOriginal.nightHours || 0),
            extraDiaria: Number(diaOriginal.extraDiaria || 0),
            marcas: diaOriginal.marcas || []
          };
        });

        // Seteamos el estado con el mapa completamente limpio y homologado
        setEntries(mapaHomologado);
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

      // // Actualizamos tu estado de React local de forma segura y homologada para evitar el 1s y el 0h
      if (typeof setEntries === 'function') {
        const mapaHomologado: Record<string, any> = {};

        Object.keys(mapaDiasFinal).forEach((fechaKey) => {
          //@ts-ignore
          const diaOriginal = mapaDiasFinal[fechaKey];

          // Convertimos los valores a números reales
          const totalHorasCalculadas = diaOriginal.hours !== undefined
            ? Number(diaOriginal.hours)
            : Number(diaOriginal.totalHours || 0);

          // 🔥 CÁLCULO DE RESPALDO PARA EL RECARGO NOCTURNO EN CALIENTE:
          // Si el día original marca 0 pero tiene horas totales, evaluamos si podemos estimar un recargo 
          // para que la interfaz visual no se caiga a 0h ni a 1s antes de recargar.
          let horasNocturnasSeguras = Number(diaOriginal.nightHours || 0);

          // Si es el día de hoy y se acaba de ponchar una salida nocturna, asignamos un estimado visual
          if (fechaKey === todayStr && tipoMarca === 'SALIDA' && horasNocturnasSeguras === 0) {
            const horaActualSistemas = new Date().getHours();
            // Si el ponchado ocurre entre las 9:00 PM (21) y las 6:00 AM
            if (horaActualSistemas >= 21 || horaActualSistemas < 6) {
              horasNocturnasSeguras = 1.0; // Seteamos 1h de contingencia visual para proteger el render
            }
          }

          mapaHomologado[fechaKey] = {
            ...diaOriginal,
            // 🔥 1. Forzamos la propiedad 'hours' numérica indispensable para el resumen superior
            hours: totalHorasCalculadas,
            // 🔥 2. Aseguramos que viaje un número puro en los recargos para erradicar el '1s'
            nightHours: horasNocturnasSeguras,
            extraDiaria: Number(diaOriginal.extraDiaria || 0),
            marcas: diaOriginal.marcas || []
          };
        });

        // Seteamos el estado local con la estructura limpia
        setEntries(mapaHomologado);
      }

      return true; // Conserva el retorno de tu función maestra

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

  const exportCurrentMonthToCSV = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Laboral', {
      views: [{ showGridLines: true }] // Mantiene la cuadrícula visible
    });

    //const monthsLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    //const currentMonthLabel = monthsLabels[currentDate.getMonth()];
    const filename = `Reporte_Horas_${currentDate.getFullYear()}_${currentDate.getMonth() + 1}.xlsx`;

    // --- 1. CONFIGURACIÓN DE COLUMNAS PRINCIPALES (ANCHO DE CELDA) ---
    worksheet.columns = [
      { header: 'FECHA', key: 'fecha', width: 14 },
      { header: 'HORA ENTRADA', key: 'entrada', width: 16 },
      { header: 'HORA SALIDA', key: 'salida', width: 16 },
      { header: 'HORAS REALES', key: 'reales', width: 18 },
      { header: 'HORAS NOCTURNAS', key: 'nocturnas', width: 22 },
      { header: 'HORAS EXTRAS (T. 7.5h)', key: 'extras', width: 22 },
      { header: '¿FESTIVO / DOMINGO?', key: 'festivo', width: 24 },
      { header: 'NOTAS / NOVEDADES', key: 'notas', width: 35 },
    ];

    // --- 2. ESTILAR ENCABEZADOS DE LA TABLA (AZUL OSCURO CORPORATIVO) ---
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // --- 3. PROCESAR E INYECTAR LAS FILAS DIARIAS CON EFECTO CEBRA AZUL ---
    const detailRows = Object.values(entries);

    detailRows.forEach((entry: any, index) => {
      const hoursNum = Number(entry.hours || 0);
      const extraDiaria = hoursNum > 7.5 ? hoursNum - 7.5 : 0;

      const row = worksheet.addRow({
        fecha: entry.date,
        entrada: entry.startTime || '',
        salida: entry.endTime || '',
        reales: hoursNum, // Guardado como número puro para permitir operaciones matemáticas
        nocturnas: Number(entry.nightHours || 0),
        extras: Number(extraDiaria.toFixed(1)),
        festivo: entry.isHolidayOrSunday ? 'SÍ' : 'NO',
        notas: entry.notes || 'Sin novedades'
      });

      row.height = 22;

      // Efecto Cebra: Filas pares con un fondo azul sutil, impares blancas
      const esPar = index % 2 === 0;
      const colorFila = esPar ? 'FFF0F4F8' : 'FFFFFFFF';

      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFila } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    });

    // --- 4. SECCIÓN DE RESUMEN METRICAS (COLUMNAS J, K, L) ---
    // Dejamos la columna I vacía como espacio de separación visual
    worksheet.getCell('J1').value = 'MÉTRICA LABORAL';
    worksheet.getCell('K1').value = 'VALOR';
    worksheet.getCell('L1').value = 'DESCRIPCIÓN';

    // Configurar anchos de la tabla de resumen
    worksheet.getColumn('J').width = 28;
    worksheet.getColumn('K').width = 14;
    worksheet.getColumn('L').width = 30;

    // Estilo de encabezados del Resumen (Azul Rey Premium)
    ['J1', 'K1', 'L1'].forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 🇨🇴 PROCESADOR MAESTRO DE LA LEY 2101 EN COLOMBIA
    const horasBaseMes = (() => {
      const [anoStr, mesStr] = currentDate.toISOString().split('T')[0].split('-');
      const anoNum = parseInt(anoStr, 10);
      const mesNum = parseInt(mesStr, 10);

      // Si el reporte es anterior a Julio de 2026, la base mensual es 220 horas
      if (anoNum < 2026 || (anoNum === 2026 && mesNum < 7)) {
        return 220;
      }

      // A partir de Julio de 2026 entra la reducción definitiva a 210 horas mensuales
      return 210;
    })();

    // Mapeo directo usando las variables exactas de tu objeto summary
    const summaryData = [
      ['Horas Reales Totales', Number(summary.totalHours) || 0, 'Tiempo neto acumulado'],
      ['Horas con Recargo', Number(summary.totalHoursWithRecargo) || 0, 'Total en Dominicales / Festivos'],
      ['Días Activos', Number(summary.workedDays) || 0, 'Jornadas registradas'],
      ['Promedio Diario', Number(summary.averageHoursPerDay) || 0, 'Media por jornada'],
      ['Recargo Nocturno', Number(summary.totalRecargoNocturno) || 0, 'Horas físicas nocturnas'],
      ['Horas Extras Acumuladas', Number(summary.totalHorasExtras) || 0, 'Suma de excesos > 7.5h']
    ];

    summaryData.forEach((metrica, idx) => {
      const filaIdx = idx + 2;
      const nombreMetrica = metrica[0];
      const valorMetrica = metrica[1];

      worksheet.getCell(`J${filaIdx}`).value = nombreMetrica;
      worksheet.getCell(`K${filaIdx}`).value = valorMetrica;

      // 📊 GRÁFICO EJECUTIVO DE BARRAS SÓLIDAS CONTINUAS (100% COMPATIBLE CON EXCELJS Y ANDROID)
      // Calculamos el porcentaje real de la métrica de forma segura para evitar divisiones por cero
      const porcentajeMétrica = Math.min(Math.round((Number(valorMetrica) / horasBaseMes) * 100), 100);

      // Generamos la barra visual usando bloques sólidos rellenos (Máximo 15 bloques para que quepa perfecto)
      const bloquesRellenos = Math.max(0, Math.min(Math.round(porcentajeMétrica / 6.6), 15));
      const barraSolida = '█'.repeat(bloquesRellenos);

      const celdaGrafico = worksheet.getCell(`L${filaIdx}`);
      // Mostramos la barra continua seguida del porcentaje exacto al lado (Ej: █████ 35%)
      celdaGrafico.value = porcentajeMétrica > 0 ? `${barraSolida} ${porcentajeMétrica}%` : '0%';

      // Aplicamos una fuente limpia de ancho fijo (Consolas) para que la barra se vea perfecta y alineada
      celdaGrafico.font = { name: 'Consolas', size: 11, bold: true, color: { argb: 'FF2563EB' } };
      celdaGrafico.alignment = { vertical: 'middle', horizontal: 'center' };


      // Aplicar cuadrícula fina gris al cuadro de resumen
      ['J', 'K', 'L'].forEach(col => {
        const cell = worksheet.getCell(`${col}${filaIdx}`);
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
        if (col === 'K') cell.alignment = { horizontal: 'center' };
      });
    });

    // --- 5. COMPONENTE DE DESCARGA MULTIPLATAFORMA COMPROBADO ---
    // Quitamos la propiedad 'addChart' rota y disparamos el buffer de forma nativa
    try {
      if (Platform.OS === 'web') {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const buffer = await workbook.xlsx.writeBuffer();
        // 🔥 TRANSFORMACIÓN NATIVA A BASE64 SIN USAR LA CLASE BUFFER DE NODE
        const uint8Array = new Uint8Array(buffer as any);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binaryString);


        const directorioNativo = (FileSystem as any).documentDirectory || (FileSystem as any).CacheDirectory || '';
        const fileUri = `${directorioNativo}${filename}`;

        await (FileSystem as any).writeAsStringAsync(fileUri, base64Data, {
          encoding: (FileSystem as any).EncodingType?.Base64 || 'base64'
        });

        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      console.error("Error crítico descargando el reporte:", error);
      alert("Hubo un fallo al empaquetar el archivo de Excel.");
    }

    // --- 6. PROCESAMIENTO DE DISPARO MULTIPLATAFORMA ---
    if (Platform.OS === 'web') {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      // Generamos el contenido binario del archivo
      const arrayBuffer = await workbook.xlsx.writeBuffer();

      // Transformación nativa multiplataforma a Base64
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binaryString);

      // 🔥 SOLUCIÓN DEFINITIVA: Extraemos el directorio rompiendo la restricción estricta de tipos
      const directorioNativo = (FileSystem as any).documentDirectory || (FileSystem as any).CacheDirectory || '';
      const fileUri = `${directorioNativo}${filename}`;

      // Escribimos el archivo usando los métodos directos del módulo mapeado
      await (FileSystem as any).writeAsStringAsync(fileUri, base64Data, {
        encoding: (FileSystem as any).EncodingType?.Base64 || 'base64'
      });

      // Disparamos la ventana de compartir nativa (iOS/Android)
      await Sharing.shareAsync(fileUri);
    }

  };

  return (
    <WorkHoursContext.Provider value={{
      entries, currentDate, summary, loading, user, userRole, goToPrevMonth, goToNextMonth, saveDayEntry, deleteDayEntry, exportCurrentMonthToCSV, punchInRealTime,
      globalSeconds, setGlobalSeconds
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
