// components/Turnstile.tsx
// Turnstile en Android/iOS: abre public/turnstile.html (servida por la app web) en un WebView y recibe el
// token por postMessage. La versión del navegador está en Turnstile.web.tsx.
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../lib/theme';
import { SITE_URL, TURNSTILE_SITE_KEY, TurnstileHandle, useColaDeTokens } from '../lib/turnstile';

export const Turnstile = forwardRef<TurnstileHandle>((_props, ref) => {
  const { esOscuro, colors: c } = useTheme();
  const webview = useRef<WebView>(null);

  const reiniciar = useCallback(() => {
    webview.current?.injectJavaScript('window.reiniciarTurnstile && window.reiniciarTurnstile(); true;');
  }, []);
  const { recibirToken, invalidarToken, obtenerToken } = useColaDeTokens(reiniciar);

  useImperativeHandle(ref, () => ({ obtenerToken }), [obtenerToken]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const mensaje = JSON.parse(event.nativeEvent.data) as { tipo: string; token?: string };
      if (mensaje.tipo === 'token' && mensaje.token) recibirToken(mensaje.token);
      else invalidarToken();
    } catch {
      invalidarToken();
    }
  };

  if (!TURNSTILE_SITE_KEY) return null;

  if (!SITE_URL) {
    // Configuración incompleta: el servidor rechazará el acceso si el CAPTCHA está activo
    return (
      <Text style={{ color: c.danger, fontSize: 12, textAlign: 'center', marginVertical: 8 }}>
        Falta EXPO_PUBLIC_SITE_URL para la verificación anti-bots.
      </Text>
    );
  }

  const url = `${SITE_URL}/turnstile.html?sitekey=${encodeURIComponent(TURNSTILE_SITE_KEY)}&tema=${esOscuro ? 'oscuro' : 'claro'}`;

  return (
    <View style={{ height: 70, marginVertical: 8 }}>
      <WebView
        ref={webview}
        source={{ uri: url }}
        onMessage={onMessage}
        originWhitelist={['https://*']}
        javaScriptEnabled
        scrollEnabled={false}
        style={{ backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
});
Turnstile.displayName = 'Turnstile';
