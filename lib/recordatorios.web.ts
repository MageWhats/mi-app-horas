// lib/recordatorios.web.ts
// El navegador no puede programar notificaciones locales: en web el aviso de turno abierto se muestra
// dentro de la app (Inicio). Misma interfaz que lib/recordatorios.ts.
export const HORAS_RECORDATORIO = 12;
export const pedirPermisoRecordatorios = async (): Promise<boolean> => false;
export const programarRecordatorio = async (_inicioTurnoMs: number) => undefined;
export const cancelarRecordatorio = async () => undefined;
