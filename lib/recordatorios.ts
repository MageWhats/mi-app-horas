// lib/recordatorios.ts
// Recordatorio local "¿olvidaste marcar la salida?" en Android/iOS (no necesita servidor de notificaciones).
// En web no existe: la app muestra el aviso dentro de Inicio (lib/recordatorios.web.ts).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const HORAS_RECORDATORIO = 12;
const ID = 'turno-abierto';
const CANAL = 'recordatorios';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let canalListo = false;
const prepararCanal = async () => {
  if (Platform.OS !== 'android' || canalListo) return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Recordatorios del turno',
    importance: Notifications.AndroidImportance.HIGH,
  });
  canalListo = true;
};

/** Pide permiso para notificaciones (se llama al marcar una entrada). */
export const pedirPermisoRecordatorios = async (): Promise<boolean> => {
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  if (!actual.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
};

/** Programa el aviso para HORAS_RECORDATORIO después del inicio del turno (reemplaza el anterior). */
export const programarRecordatorio = async (inicioTurnoMs: number) => {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  const cuando = inicioTurnoMs + HORAS_RECORDATORIO * 3_600_000;
  if (cuando <= Date.now()) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  await prepararCanal();
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: '¿Olvidaste marcar la salida?',
      body: `Llevas ${HORAS_RECORDATORIO} horas con el turno abierto. Si ya terminaste, marca tu salida en la app.`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: cuando, channelId: CANAL },
  });
};

export const cancelarRecordatorio = async () => {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
};
