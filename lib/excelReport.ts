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
  const marcas = entry.marcas ?? [];
  const primeraEntrada = marcas.find((m) => m.tipo === 'ENTRADA' || m.tipo === 'MANUAL');
  const ultimaSalida = [...marcas].reverse().find((m) => m.tipo === 'SALIDA' || m.tipo === 'MANUAL');

  return {
    entrada: entry.startTime || primeraEntrada?.horaIngreso || (primeraEntrada?.tipo === 'ENTRADA' ? primeraEntrada.hora : ''),
    salida: entry.endTime || ultimaSalida?.horaSalida || (ultimaSalida?.tipo === 'SALIDA' ? ultimaSalida.hora : ''),
  };
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
    { header: 'MARCAS SIN GPS (MOTIVO)', key: 'sinGps', width: 40 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // --- 2. Filas diarias en orden cronológico con efecto cebra ---
  const detailRows = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));

  detailRows.forEach((entry, index) => {
    const hoursNum = Number(entry.hours || 0);
    const extraDiaria = hoursNum > 7.5 ? hoursNum - 7.5 : 0;
    const { entrada, salida } = getEntradaSalida(entry);

    const row = worksheet.addRow({
      fecha: entry.date,
      entrada,
      salida,
      reales: Number(hoursNum.toFixed(2)),
      nocturnas: Number(entry.nightHours || 0),
      extras: Number(extraDiaria.toFixed(1)),
      festivo: entry.isHolidayOrSunday ? 'SÍ' : 'NO',
      notas: entry.notes || 'Sin novedades',
      sinGps: (entry.marcas ?? [])
        .filter((m) => m.motivoSinGps)
        .map((m) => `${m.tipo} ${m.hora}: ${m.motivoSinGps}`)
        .join(' | '),
    });

    row.height = 22;
    const colorFila = index % 2 === 0 ? 'FFF0F4F8' : 'FFFFFFFF';
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFila } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  });

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

  // --- 4. Descarga (web) o compartir (Android/iOS) ---
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
