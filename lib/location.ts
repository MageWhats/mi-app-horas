// lib/location.ts
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Android reporta que la ubicación viene de una app de GPS falso */
  simulada?: boolean;
}

/** Por qué no se pudo obtener la ubicación. */
export type FalloGps = 'PERMISO' | 'PERMISO_BLOQUEADO' | 'SERVICIOS' | 'TIEMPO' | 'NO_DISPONIBLE';

export type ResultadoUbicacion =
  | { ok: true; coords: GeoCoords }
  | { ok: false; fallo: FalloGps };

const TIEMPO_LIMITE_MS = 15_000;
const MAX_ANTIGUEDAD_MS = 2 * 60_000; // Una ubicación de respaldo no puede tener más de 2 minutos
const PRECISION_MINIMA_M = 200;

const conTiempoLimite = <T,>(promesa: Promise<T>, ms: number) =>
  Promise.race([promesa, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIEMPO')), ms))]);

const ubicacionWeb = (): Promise<ResultadoUbicacion> => new Promise((resolve) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    resolve({ ok: false, fallo: 'NO_DISPONIBLE' });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ ok: true, coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy } }),
    (error) => resolve({
      ok: false,
      fallo: error.code === error.PERMISSION_DENIED ? 'PERMISO' : error.code === error.TIMEOUT ? 'TIEMPO' : 'NO_DISPONIBLE',
    }),
    { enableHighAccuracy: true, timeout: TIEMPO_LIMITE_MS, maximumAge: 30_000 },
  );
});

const ubicacionNativa = async (): Promise<ResultadoUbicacion> => {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (permiso.status !== 'granted') {
    return { ok: false, fallo: permiso.canAskAgain ? 'PERMISO' : 'PERMISO_BLOQUEADO' };
  }

  if (!(await Location.hasServicesEnabledAsync())) {
    return { ok: false, fallo: 'SERVICIOS' };
  }

  try {
    const loc = await conTiempoLimite(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      TIEMPO_LIMITE_MS,
    );
    return { ok: true, coords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy, simulada: loc.mocked === true } };
  } catch {
    // Respaldo: última ubicación conocida, solo si es reciente y precisa
    const ultima = await Location.getLastKnownPositionAsync({ maxAge: MAX_ANTIGUEDAD_MS, requiredAccuracy: PRECISION_MINIMA_M });
    if (ultima) {
      return { ok: true, coords: { latitude: ultima.coords.latitude, longitude: ultima.coords.longitude, accuracy: ultima.coords.accuracy, simulada: ultima.mocked === true } };
    }
    return { ok: false, fallo: 'TIEMPO' };
  }
};

/** Obtiene la ubicación actual sin lanzar errores: devuelve las coordenadas o el motivo del fallo. */
export const obtenerUbicacion = async (): Promise<ResultadoUbicacion> => {
  try {
    return Platform.OS === 'web' ? await ubicacionWeb() : await ubicacionNativa();
  } catch (error) {
    console.warn('Error obteniendo la ubicación:', error);
    return { ok: false, fallo: 'NO_DISPONIBLE' };
  }
};
