// lib/colaMarcas.ts
// Marcas registradas sin conexión: se guardan en el celular y se envían en orden al volver la señal
// (función ponchar_sin_conexion). La base de datos valida la hora y las deja señaladas.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeoCoords } from './location';

export interface MarcaPendiente {
  idCliente: string;          // evita duplicados si el envío se reintenta
  tipo: 'ENTRADA' | 'SALIDA';
  momento: string;            // ISO, hora del celular
  coords: GeoCoords | null;
  motivoSinGps?: string;
  estado: 'pendiente' | 'rechazada';
  error?: string;             // motivo del rechazo de la base de datos
}

const clave = (userId: string) => `netsec-horas:cola-marcas:${userId}`;

export const leerCola = async (userId: string): Promise<MarcaPendiente[]> => {
  try {
    const guardada = await AsyncStorage.getItem(clave(userId));
    return guardada ? (JSON.parse(guardada) as MarcaPendiente[]) : [];
  } catch {
    return [];
  }
};

export const guardarCola = async (userId: string, cola: MarcaPendiente[]) => {
  try {
    if (cola.length === 0) await AsyncStorage.removeItem(clave(userId));
    else await AsyncStorage.setItem(clave(userId), JSON.stringify(cola));
  } catch (error) {
    console.error('No se pudo guardar la cola de marcas:', error);
  }
};

/** UUID v4 (identificador de reintento, no de seguridad). */
export const generarIdCliente = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** true si el error es de red (sin conexión), no una validación de la base de datos. */
export const esErrorDeRed = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string; name?: string } | null;
  if (!e) return false;
  if (e.code && e.code !== '') return false;
  return /fetch|network|internet|timed? ?out|abort/i.test(`${e.name ?? ''} ${e.message ?? ''}`);
};
