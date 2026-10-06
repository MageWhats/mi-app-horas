// Cálculos de horas y reglas laborales colombianas (lib/utils.ts)
import { describe, expect, it } from 'vitest';
import {
  addDays,
  calculateHoursAndNightSplit,
  calculateMonthlySummary,
  calculateRealtimeHours,
  esDomingoOFestivo,
  festivosColombia,
  getColombianWeeklyLimit,
  getFranjaNocturnaLabel,
  getRecargoDominical,
  getUltimaMarcaRealtime,
  getWeekRangesOfMonth,
  nombreFestivo,
  parseHoraAMinutos,
  toLocalDateStr,
} from '../lib/utils';
import { Marca } from '../types/hours';

const marca = (tipo: Marca['tipo'], iso: string): Marca => ({ id: tipo + iso, tipo, hora: '', timestamp: new Date(iso).toISOString() });

describe('horas manuales', () => {
  it('acepta formato 24 h (web) y 12 h (Android/iOS)', () => {
    expect(parseHoraAMinutos('21:30')).toBe(21 * 60 + 30);
    expect(parseHoraAMinutos('9:30 p. m.')).toBe(21 * 60 + 30);
    expect(parseHoraAMinutos('12:15 PM')).toBe(12 * 60 + 15);
    expect(parseHoraAMinutos('12:30 a. m.')).toBe(30);
  });

  it('calcula horas y nocturnas cruzando la medianoche', () => {
    expect(calculateHoursAndNightSplit('08:00 p. m.', '02:00 a. m.', '2026-10-05')).toEqual({ totalHours: 6, nightHours: 6 });
    expect(calculateHoursAndNightSplit('08:00', '17:30', '2026-10-05')).toEqual({ totalHours: 9.5, nightHours: 0 });
  });
});

describe('Ley 2466 de 2025: franja nocturna y recargo dominical', () => {
  it('la jornada nocturna empieza a las 7 p. m. desde el 25 de diciembre de 2025', () => {
    expect(calculateHoursAndNightSplit('18:00', '23:00', '2025-06-10').nightHours).toBe(2);
    expect(calculateHoursAndNightSplit('18:00', '23:00', '2026-10-05').nightHours).toBe(4);
    expect(getFranjaNocturnaLabel('2025-12-24')).toBe('9 p. m. a 6 a. m.');
    expect(getFranjaNocturnaLabel('2025-12-25')).toBe('7 p. m. a 6 a. m.');
  });

  it('el recargo dominical sube cada 1 de julio', () => {
    expect(getRecargoDominical('2025-06-30')).toBe(75);
    expect(getRecargoDominical('2025-07-01')).toBe(80);
    expect(getRecargoDominical('2026-07-01')).toBe(90);
    expect(getRecargoDominical('2027-07-01')).toBe(100);
  });
});

describe('Ley 2101: límite semanal', () => {
  it('se reduce cada 15 de julio', () => {
    expect(getColombianWeeklyLimit('2025-03-01')).toBe(46);
    expect(getColombianWeeklyLimit('2026-07-14')).toBe(44);
    expect(getColombianWeeklyLimit('2026-07-15')).toBe(42);
  });
});

describe('festivos de Colombia (Ley Emiliani)', () => {
  it('2026 tiene los 18 festivos oficiales', () => {
    expect([...festivosColombia(2026).keys()].sort()).toEqual([
      '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08',
      '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16',
      '2026-12-08', '2026-12-25',
    ]);
  });

  it('dos festivos el mismo lunes conservan ambos nombres (30 de junio de 2025)', () => {
    expect(nombreFestivo('2025-06-30')).toBe('San Pedro y San Pablo / Sagrado Corazón');
  });

  it('domingos y festivos llevan recargo; los días hábiles no', () => {
    expect(esDomingoOFestivo('2026-10-04')).toBe(true); // domingo
    expect(esDomingoOFestivo('2026-10-12')).toBe(true); // Día de la Raza
    expect(esDomingoOFestivo('2026-10-05')).toBe(false);
  });
});

describe('marcas en tiempo real', () => {
  it('suma tramos ENTRADA → SALIDA e ignora las marcas manuales intercaladas', () => {
    const marcas = [
      marca('ENTRADA', '2026-10-05T08:00:00-05:00'),
      marca('SALIDA', '2026-10-05T12:00:00-05:00'),
      { id: 'm', tipo: 'MANUAL' as const, hora: '' },
      marca('ENTRADA', '2026-10-05T13:00:00-05:00'),
      marca('SALIDA', '2026-10-05T22:00:00-05:00'),
    ];
    expect(calculateRealtimeHours(marcas)).toEqual({ totalHours: 13, nightHours: 3 });
  });

  it('un turno abierto no suma y la última marca ignora las manuales', () => {
    const abierto = [marca('ENTRADA', '2026-10-05T08:00:00-05:00'), { id: 'm', tipo: 'MANUAL' as const, hora: '' }];
    expect(calculateRealtimeHours(abierto).totalHours).toBe(0);
    expect(getUltimaMarcaRealtime(abierto)?.tipo).toBe('ENTRADA');
  });
});

describe('fechas y resumen mensual', () => {
  it('maneja fechas locales y cruces de mes', () => {
    expect(toLocalDateStr(new Date('2026-10-05T21:00:00-05:00'))).toBe('2026-10-05');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('agrupa por semanas de calendario (lunes a domingo)', () => {
    expect(getWeekRangesOfMonth(2026, 9)).toEqual([
      { from: 1, to: 4 }, { from: 5, to: 11 }, { from: 12, to: 18 }, { from: 19, to: 25 }, { from: 26, to: 31 },
    ]);
    expect(getWeekRangesOfMonth(2026, 2)).toHaveLength(6);
  });

  it('calcula días trabajados, promedio, extras y límites por semana', () => {
    const s = calculateMonthlySummary([
      { date: '2026-07-06', hours: 9, nightHours: 0, isHolidayOrSunday: false },
      { date: '2026-07-07', hours: 0, nightHours: 0, isHolidayOrSunday: false },
      { date: '2026-07-20', hours: 6, nightHours: 2, isHolidayOrSunday: true },
    ], 2026, 6);
    expect(s.workedDays).toBe(2);
    expect(s.averageHoursPerDay).toBe(7.5);
    expect(s.totalHorasExtras).toBe(1.5);
    expect(s.totalHoursWithRecargo).toBe(6);
    expect(s.weeklyLimits).toEqual([44, 44, 44, 42, 42]);
  });
});
