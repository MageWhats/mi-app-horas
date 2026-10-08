// lib/location.ts
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

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
// Si el navegador niega el permiso más rápido que esto, no alcanzó a mostrar la ventana: está bloqueado
const RECHAZO_INSTANTANEO_MS = 1_000;

const conTiempoLimite = <T,>(promesa: Promise<T>, ms: number) =>
  Promise.race([promesa, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIEMPO')), ms))]);

// ---------- Web (navegador y PWA) ----------

export type SistemaWeb = 'ios' | 'android' | 'escritorio';

export interface EntornoWeb {
  sistema: SistemaWeb;
  /** Navegador en uso (en iOS todos usan el motor de Safari, pero el permiso del sistema es por app) */
  navegador: string;
  /** Abierta como app instalada desde la pantalla de inicio */
  instalada: boolean;
}

export const entornoWeb = (): EntornoWeb => {
  if (typeof navigator === 'undefined') return { sistema: 'escritorio', navegador: 'el navegador', instalada: false };
  const ua = navigator.userAgent;
  // El iPad con iPadOS se presenta como Mac, pero tiene pantalla táctil
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const sistema: SistemaWeb = ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'escritorio';

  let navegador = 'el navegador';
  if (ios) {
    navegador = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS/.test(ua) ? 'Edge' : 'Safari';
  } else if (/SamsungBrowser/.test(ua)) navegador = 'Samsung Internet';
  else if (/Edg\//.test(ua)) navegador = 'Edge';
  else if (/Firefox/.test(ua)) navegador = 'Firefox';
  else if (/Chrome/.test(ua)) navegador = 'Chrome';

  const instalada = (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { sistema, navegador, instalada };
};

/** Estado del permiso según el navegador. Safari < 16 no lo informa: devuelve null. */
const estadoPermisoWeb = async (): Promise<PermissionState | null> => {
  try {
    if (!navigator.permissions?.query) return null;
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return null;
  }
};

/**
 * Avisa cuando el usuario concede el permiso desde los ajustes del navegador sin recargar.
 * Devuelve la función para dejar de escuchar.
 */
export const alConcederPermisoWeb = (callback: () => void): (() => void) => {
  let estado: PermissionStatus | null = null;
  let activo = true;
  const alCambiar = () => { if (estado?.state === 'granted') callback(); };
  navigator.permissions?.query({ name: 'geolocation' })
    .then((s) => {
      if (!activo) return;
      estado = s;
      s.addEventListener('change', alCambiar);
    })
    .catch(() => {});
  return () => {
    activo = false;
    estado?.removeEventListener('change', alCambiar);
  };
};

const posicionWeb = (opciones: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject, opciones);
});

const coordsWeb = (pos: GeolocationPosition): ResultadoUbicacion => ({
  ok: true,
  coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
});

const ubicacionWeb = async (): Promise<ResultadoUbicacion> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation || (typeof window !== 'undefined' && !window.isSecureContext)) {
    return { ok: false, fallo: 'NO_DISPONIBLE' };
  }

  // Siempre se llama a getCurrentPosition, aunque el permiso figure como denegado:
  // es lo único que hace aparecer la ventana de permiso (Safari vuelve a preguntar tras recargar).
  const inicio = Date.now();
  try {
    return coordsWeb(await posicionWeb({ enableHighAccuracy: true, timeout: TIEMPO_LIMITE_MS, maximumAge: 30_000 }));
  } catch (e) {
    const error = e as GeolocationPositionError;
    if (error.code === error.PERMISSION_DENIED) {
      const instantaneo = Date.now() - inicio < RECHAZO_INSTANTANEO_MS;
      const estado = await estadoPermisoWeb();
      // Si la ventana no llegó a mostrarse, insistir con "Reintentar" no sirve: hay que ir a los ajustes
      return { ok: false, fallo: instantaneo || estado === 'denied' ? 'PERMISO_BLOQUEADO' : 'PERMISO' };
    }
  }

  // Sin señal GPS a tiempo: se acepta una ubicación menos precisa (Wi-Fi o red móvil) y algo más antigua
  try {
    return coordsWeb(await posicionWeb({ enableHighAccuracy: false, timeout: 10_000, maximumAge: MAX_ANTIGUEDAD_MS }));
  } catch (e) {
    const error = e as GeolocationPositionError;
    // POSITION_UNAVAILABLE suele significar que la ubicación del celular está apagada
    return { ok: false, fallo: error.code === error.POSITION_UNAVAILABLE ? 'SERVICIOS' : 'TIEMPO' };
  }
};

// ---------- App nativa ----------

const ubicacionNativa = async (): Promise<ResultadoUbicacion> => {
  let permiso = await Location.getForegroundPermissionsAsync();
  if (permiso.status !== 'granted' && permiso.canAskAgain) {
    permiso = await Location.requestForegroundPermissionsAsync();
  }
  if (permiso.status !== 'granted') {
    return { ok: false, fallo: permiso.canAskAgain ? 'PERMISO' : 'PERMISO_BLOQUEADO' };
  }

  if (!(await Location.hasServicesEnabledAsync())) {
    // Android permite pedir que se encienda la ubicación con la ventana del sistema, sin salir de la app
    let encendida = false;
    if (Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
        encendida = await Location.hasServicesEnabledAsync();
      } catch {
        // El usuario rechazó la ventana
      }
    }
    if (!encendida) return { ok: false, fallo: 'SERVICIOS' };
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

// ---------- Estado del permiso (sin pedirlo) ----------

/** Situación del permiso de ubicación. DESCONOCIDO: el navegador no lo informa (Safari < 16). */
export type EstadoUbicacion = 'CONCEDIDO' | 'PREGUNTAR' | 'BLOQUEADO' | 'APAGADO' | 'DESCONOCIDO';

/** Consulta el permiso sin mostrar ninguna ventana al usuario. */
export const consultarEstadoUbicacion = async (): Promise<EstadoUbicacion> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return 'DESCONOCIDO';
      const estado = await estadoPermisoWeb();
      return estado === 'granted' ? 'CONCEDIDO' : estado === 'prompt' ? 'PREGUNTAR' : estado === 'denied' ? 'BLOQUEADO' : 'DESCONOCIDO';
    }
    const permiso = await Location.getForegroundPermissionsAsync();
    if (permiso.status !== 'granted') return permiso.canAskAgain ? 'PREGUNTAR' : 'BLOQUEADO';
    return (await Location.hasServicesEnabledAsync()) ? 'CONCEDIDO' : 'APAGADO';
  } catch {
    return 'DESCONOCIDO';
  }
};

/** Estado del permiso, actualizado al volver a la app o cuando cambia en el navegador. */
export const useEstadoUbicacion = () => {
  const [estado, setEstado] = useState<EstadoUbicacion | null>(null);
  const refrescar = useCallback(async () => setEstado(await consultarEstadoUbicacion()), []);

  useEffect(() => {
    refrescar();
    if (Platform.OS === 'web') {
      const alVolver = () => { if (document.visibilityState === 'visible') refrescar(); };
      document.addEventListener('visibilitychange', alVolver);
      let permiso: PermissionStatus | null = null;
      let activo = true;
      const alCambiar = () => { refrescar(); };
      navigator.permissions?.query({ name: 'geolocation' })
        .then((s) => {
          if (!activo) return;
          permiso = s;
          s.addEventListener('change', alCambiar);
        })
        .catch(() => {});
      return () => {
        activo = false;
        document.removeEventListener('visibilitychange', alVolver);
        permiso?.removeEventListener('change', alCambiar);
      };
    }
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refrescar(); });
    return () => sub.remove();
  }, [refrescar]);

  return { estado, refrescar };
};
