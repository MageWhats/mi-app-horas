// lib/excelReport.ts
import ExcelJS from 'exceljs';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { DayEntry, MonthlySummary } from '../types/hours';
import { getFranjaNocturnaLabel, getRecargoDominical, toLocalDateStr } from './utils';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Primera hora de ingreso y última de salida del día, sea por marcas en tiempo real o manuales. */
const getEntradaSalida = (entry: DayEntry) => {
  const marcas = (entry.marcas ?? []).filter((m) => !m.anulada);
  const primeraEntrada = marcas.find((m) => m.tipo === 'ENTRADA' || m.tipo === 'MANUAL');
  const ultimaSalida = [...marcas].reverse().find((m) => m.tipo === 'SALIDA' || m.tipo === 'MANUAL');

  return {
    entrada: primeraEntrada?.horaIngreso || (primeraEntrada?.tipo === 'ENTRADA' ? primeraEntrada.hora : ''),
    salida: ultimaSalida?.horaSalida || (ultimaSalida?.tipo === 'SALIDA' ? ultimaSalida.hora : ''),
  };
};

/** Marcas sin GPS, con ubicación simulada o anuladas, con su motivo. */
const observacionesAuditoria = (entry: DayEntry) =>
  (entry.marcas ?? [])
    .flatMap((m) => [
      m.motivoSinGps ? `${m.tipo} ${m.hora} sin GPS: ${m.motivoSinGps}` : null,
      m.ubicacionSimulada ? `${m.tipo} ${m.hora}: ubicación simulada` : null,
      m.sinConexion ? `${m.tipo} ${m.hora}: registrada sin conexión (hora del celular)` : null,
      m.anulada ? `${m.tipo} ${m.hora} ANULADA: ${m.motivoAnulacion ?? ''}` : null,
    ])
    .filter(Boolean)
    .join(' | ');

/** Cantidad de marcas que requieren revisión: sin GPS, GPS simulado, sin conexión o anuladas. */
export const contarAlertas = (entries: Record<string, DayEntry>) =>
  Object.values(entries).flatMap((d) => d.marcas ?? [])
    .filter((m) => m.motivoSinGps || m.ubicacionSimulada || m.sinConexion || m.anulada).length;

const estilizarEncabezado = (fila: ExcelJS.Row) => {
  fila.height = 28;
  fila.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
};

const estilizarFila = (fila: ExcelJS.Row, indice: number) => {
  fila.height = 22;
  const color = indice % 2 === 0 ? 'FFF0F4F8' : 'FFFFFFFF';
  fila.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, top: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
};

/** Valores de una fila diaria (compartidos por el reporte individual y el del equipo). */
const datosDelDia = (entry: DayEntry) => {
  const horas = Number(entry.hours || 0);
  const { entrada, salida } = getEntradaSalida(entry);
  return {
    fecha: entry.date,
    entrada,
    salida,
    reales: Number(horas.toFixed(2)),
    nocturnas: Number(entry.nightHours || 0),
    extras: Number((horas > 7.5 ? horas - 7.5 : 0).toFixed(1)),
    festivo: entry.isHolidayOrSunday ? 'SÍ' : 'NO',
    notas: entry.notes || 'Sin novedades',
    auditoria: observacionesAuditoria(entry),
  };
};

/** Descarga el libro (web) o abre el menú de compartir (Android/iOS). */
const entregarLibro = async (workbook: ExcelJS.Workbook, filename: string) => {
  const buffer = await workbook.xlsx.writeBuffer();

  if (Platform.OS === 'web') {
    const url = window.URL.createObjectURL(new Blob([buffer], { type: MIME_XLSX }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(new Uint8Array(buffer as ArrayBuffer));
  await Sharing.shareAsync(file.uri, { mimeType: MIME_XLSX, dialogTitle: 'Reporte de horas' });
};

/** Horas ordinarias del mes según la Ley 2101 (210 h desde julio de 2026). */
const getHorasBaseMes = (date: Date) => {
  const anio = date.getFullYear();
  const mes = date.getMonth() + 1;
  return anio < 2026 || (anio === 2026 && mes < 7) ? 220 : 210;
};

export const exportMonthToExcel = async (
  entries: Record<string, DayEntry>,
  summary: MonthlySummary,
  currentDate: Date,
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Reporte Laboral', { views: [{ showGridLines: true }] });
  const filename = `Reporte_Horas_${currentDate.getFullYear()}_${currentDate.getMonth() + 1}.xlsx`;

  // --- 1. Columnas principales ---
  worksheet.columns = [
    { header: 'FECHA', key: 'fecha', width: 14 },
    { header: 'HORA ENTRADA', key: 'entrada', width: 16 },
    { header: 'HORA SALIDA', key: 'salida', width: 16 },
    { header: 'HORAS REALES', key: 'reales', width: 18 },
    { header: 'HORAS NOCTURNAS', key: 'nocturnas', width: 22 },
    { header: 'HORAS EXTRAS (T. 7.5h)', key: 'extras', width: 22 },
    { header: '¿FESTIVO / DOMINGO?', key: 'festivo', width: 24 },
    { header: 'NOTAS / NOVEDADES', key: 'notas', width: 35 },
    { header: 'OBSERVACIONES DE AUDITORÍA', key: 'auditoria', width: 50 },
  ];

  estilizarEncabezado(worksheet.getRow(1));

  // --- 2. Filas diarias en orden cronológico con efecto cebra ---
  Object.values(entries)
    .sort((x, y) => x.date.localeCompare(y.date))
    .forEach((entry, index) => estilizarFila(worksheet.addRow(datosDelDia(entry)), index));

  // --- 3. Resumen de métricas (columnas K, L, M; la J queda de separación) ---
  worksheet.getCell('K1').value = 'MÉTRICA LABORAL';
  worksheet.getCell('L1').value = 'VALOR';
  worksheet.getCell('M1').value = 'DESCRIPCIÓN';
  worksheet.getColumn('K').width = 38;
  worksheet.getColumn('L').width = 14;
  worksheet.getColumn('M').width = 30;

  ['K1', 'L1', 'M1'].forEach((cellRef) => {
    const cell = worksheet.getCell(cellRef);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const horasBaseMes = getHorasBaseMes(currentDate);
  const cierreMes = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
  const summaryData: [string, number][] = [
    ['Horas Reales Totales', summary.totalHours],
    [`Horas Dominicales/Festivas (+${getRecargoDominical(cierreMes)}%)`, summary.totalHoursWithRecargo],
    ['Días Activos', summary.workedDays],
    ['Promedio Diario', summary.averageHoursPerDay],
    [`Horas Nocturnas (${getFranjaNocturnaLabel(cierreMes)})`, summary.totalRecargoNocturno],
    ['Horas Extras Acumuladas', summary.totalHorasExtras],
  ];

  summaryData.forEach(([nombre, valor], idx) => {
    const fila = idx + 2;
    worksheet.getCell(`K${fila}`).value = nombre;
    worksheet.getCell(`L${fila}`).value = Number(valor) || 0;

    // Barra de texto proporcional a las horas ordinarias del mes (máx. 15 bloques)
    const porcentaje = Math.min(Math.round((Number(valor) / horasBaseMes) * 100), 100);
    const bloques = Math.max(0, Math.min(Math.round(porcentaje / 6.6), 15));
    const celdaGrafico = worksheet.getCell(`M${fila}`);
    celdaGrafico.value = porcentaje > 0 ? `${'█'.repeat(bloques)} ${porcentaje}%` : '0%';
    celdaGrafico.font = { name: 'Consolas', size: 11, bold: true, color: { argb: 'FF2563EB' } };
    celdaGrafico.alignment = { vertical: 'middle', horizontal: 'center' };

    ['K', 'L', 'M'].forEach((col) => {
      const cell = worksheet.getCell(`${col}${fila}`);
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
      if (col === 'L') cell.alignment = { horizontal: 'center' };
    });
  });

  await entregarLibro(workbook, filename);
};

export interface OperarioReporte {
  nombre: string;
  cedula: string;
  entries: Record<string, DayEntry>;
  summary: MonthlySummary;
}

/** Reporte consolidado del equipo (supervisores): hoja de resumen por operario y hoja con el detalle diario. */
export const exportEquipoToExcel = async (operarios: OperarioReporte[], currentDate: Date) => {
  const workbook = new ExcelJS.Workbook();
  const cierreMes = toLocalDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
  const filename = `Reporte_Equipo_${currentDate.getFullYear()}_${currentDate.getMonth() + 1}.xlsx`;

  // Resumen
  const resumen = workbook.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] });
  resumen.columns = [
    { header: 'OPERARIO', key: 'nombre', width: 32 },
    { header: 'CÉDULA', key: 'cedula', width: 16 },
    { header: 'DÍAS TRABAJADOS', key: 'dias', width: 14 },
    { header: 'HORAS REALES', key: 'horas', width: 14 },
    { header: 'HORAS EXTRAS (> 7.5 h/día)', key: 'extras', width: 16 },
    { header: `HORAS NOCTURNAS (${getFranjaNocturnaLabel(cierreMes)})`, key: 'nocturnas', width: 18 },
    { header: `DOMINICALES / FESTIVAS (+${getRecargoDominical(cierreMes)}%)`, key: 'dominicales', width: 18 },
    { header: 'MARCAS POR REVISAR', key: 'alertas', width: 14 },
  ];
  estilizarEncabezado(resumen.getRow(1));
  operarios.forEach((o, i) => estilizarFila(resumen.addRow({
    nombre: o.nombre,
    cedula: o.cedula,
    dias: o.summary.workedDays,
    horas: o.summary.totalHours,
    extras: o.summary.totalHorasExtras,
    nocturnas: o.summary.totalRecargoNocturno,
    dominicales: o.summary.totalHoursWithRecargo,
    alertas: contarAlertas(o.entries),
  }), i));

  // Detalle diario de todos los operarios
  const detalle = workbook.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
  detalle.columns = [
    { header: 'OPERARIO', key: 'nombre', width: 32 },
    { header: 'CÉDULA', key: 'cedula', width: 16 },
    { header: 'FECHA', key: 'fecha', width: 14 },
    { header: 'HORA ENTRADA', key: 'entrada', width: 16 },
    { header: 'HORA SALIDA', key: 'salida', width: 16 },
    { header: 'HORAS REALES', key: 'reales', width: 14 },
    { header: 'HORAS NOCTURNAS', key: 'nocturnas', width: 16 },
    { header: 'HORAS EXTRAS', key: 'extras', width: 14 },
    { header: '¿FESTIVO / DOMINGO?', key: 'festivo', width: 14 },
    { header: 'NOTAS / NOVEDADES', key: 'notas', width: 35 },
    { header: 'OBSERVACIONES DE AUDITORÍA', key: 'auditoria', width: 50 },
  ];
  estilizarEncabezado(detalle.getRow(1));
  let fila = 0;
  for (const o of operarios) {
    Object.values(o.entries)
      .sort((x, y) => x.date.localeCompare(y.date))
      .forEach((entry) => estilizarFila(detalle.addRow({ nombre: o.nombre, cedula: o.cedula, ...datosDelDia(entry) }), fila++));
  }

  await entregarLibro(workbook, filename);
};
