// lib/turnstile.ts
// Verificación anti-bots con Cloudflare Turnstile. Es opcional: sin EXPO_PUBLIC_TURNSTILE_SITE_KEY la app
// funciona sin ella (igual que el inventario). Cómo activarla: supabase/README.md → CAPTCHA.
import { useCallback, useRef } from 'react';

/** Site Key pública de Turnstile (la Secret Key nunca va en la app). */
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

/** URL pública de la app web: Android/iOS abren desde ahí la página public/turnstile.html. */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') || null;

const ESPERA_MAXIMA_MS = 30_000;

export interface TurnstileHandle {
  /** Devuelve un token sin usar (o undefined si el CAPTCHA no está configurado) y prepara el siguiente. */
  obtenerToken: () => Promise<string | undefined>;
}

/**
 * Cola de tokens compartida por las versiones web y nativa del widget.
 * Cada token sirve para una sola verificación: al entregarlo se pide uno nuevo con `reiniciar`.
 */
export const useColaDeTokens = (reiniciar: () => void) => {
  const token = useRef<string | null>(null);
  const esperando = useRef<{ resolver: (t: string) => void; rechazar: (e: Error) => void }[]>([]);

  const recibirToken = useCallback((nuevo: string) => {
    const pendiente = esperando.current.shift();
    if (pendiente) {
      pendiente.resolver(nuevo);
      reiniciar();
    } else {
      token.current = nuevo;
    }
  }, [reiniciar]);

  const invalidarToken = useCallback(() => {
    token.current = null;
  }, []);

  const obtenerToken = useCallback(async (): Promise<string | undefined> => {
    if (!TURNSTILE_SITE_KEY) return undefined;

    if (token.current) {
      const listo = token.current;
      token.current = null;
      reiniciar();
      return listo;
    }

    return new Promise<string>((resolver, rechazar) => {
      const entrada = { resolver, rechazar };
      esperando.current.push(entrada);
      setTimeout(() => {
        const i = esperando.current.indexOf(entrada);
        if (i >= 0) {
          esperando.current.splice(i, 1);
          rechazar(new Error('No se pudo completar la verificación anti-bots. Inténtalo de nuevo.'));
        }
      }, ESPERA_MAXIMA_MS);
    });
  }, [reiniciar]);

  return { recibirToken, invalidarToken, obtenerToken };
};
