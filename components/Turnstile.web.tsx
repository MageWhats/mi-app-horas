// components/Turnstile.web.tsx
// Widget de Cloudflare Turnstile en el navegador (la versión para Android/iOS está en Turnstile.tsx).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { useTheme } from '../lib/theme';
import { TURNSTILE_SITE_KEY, TurnstileHandle, useColaDeTokens } from '../lib/turnstile';

interface TurnstileApi {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let cargaScript: Promise<void> | null = null;

const cargarScript = () => {
  if (window.turnstile) return Promise.resolve();
  cargaScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { cargaScript = null; reject(new Error('No se pudo cargar Turnstile')); };
    document.head.appendChild(script);
  });
  return cargaScript;
};

export const Turnstile = forwardRef<TurnstileHandle>((_props, ref) => {
  const { esOscuro } = useTheme();
  const contenedor = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const reiniciar = useCallback(() => {
    if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
  }, []);
  const { recibirToken, invalidarToken, obtenerToken } = useColaDeTokens(reiniciar);

  useImperativeHandle(ref, () => ({ obtenerToken }), [obtenerToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelado = false;

    cargarScript()
      .then(() => {
        if (cancelado || !contenedor.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(contenedor.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: esOscuro ? 'dark' : 'light',
          language: 'es',
          callback: recibirToken,
          'expired-callback': invalidarToken,
          'error-callback': invalidarToken,
        });
      })
      .catch((e) => console.error(e));

    return () => {
      cancelado = true;
      if (window.turnstile && widgetId.current) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [esOscuro, recibirToken, invalidarToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <View style={{ alignItems: 'center', marginVertical: 8, minHeight: 65 }}>
      <div ref={contenedor} />
    </View>
  );
});
Turnstile.displayName = 'Turnstile';
