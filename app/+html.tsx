import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// Solo web: HTML raíz de cada página durante el renderizado estático (corre en Node, sin acceso al DOM).
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0b0f19" />

        {/* App instalable (PWA): manifest, ícono para iPhone y modo pantalla completa */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Horas" />
        <meta name="description" content="Control de Horas de Net&Sec Suministros: registro de jornadas con GPS." />

        {/* Desactiva el scroll del body para que los ScrollView se comporten como en el celular */}
        <ScrollViewStyleReset />

        {/* Mismo fondo que la pantalla de carga y el splash: evita el destello blanco al abrir */}
        <style dangerouslySetInnerHTML={{ __html: 'body { background-color: #0b0f19; }' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
