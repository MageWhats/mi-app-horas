// scripts/generar-iconos.mjs
// Genera los íconos PNG de la app (ícono, Android adaptativo, splash y favicon) a partir de branding/simbolo.svg.
// Uso: npm i -D @resvg/resvg-js && node scripts/generar-iconos.mjs
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = process.env.RAIZ ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'assets', 'images');
const simbolo = fs.readFileSync(path.join(raiz, 'branding', 'simbolo.svg'), 'utf8');
const plano = fs.readFileSync(path.join(raiz, 'branding', 'simbolo-plano.svg'), 'utf8');

/** Contenido interno de un SVG (sin la etiqueta <svg>), para incrustarlo escalado en otro lienzo */
const interior = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/**
 * Lienzo cuadrado de `lado` px con el símbolo centrado ocupando `proporcion` del ancho.
 * `fondo` null = transparente.
 */
const lienzo = (contenido, lado, proporcion, fondo) => {
  const tam = 1000 / proporcion;
  const desfase = (tam - 1000) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="${-desfase} ${-desfase} ${tam} ${tam}">
    ${fondo ? `<rect x="${-desfase}" y="${-desfase}" width="${tam}" height="${tam}" fill="${fondo}"/>` : ''}
    ${contenido}
  </svg>`;
};

const png = (svg, archivo) => {
  const datos = new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
  fs.writeFileSync(path.join(salida, archivo), datos);
  console.log(`✓ ${archivo}`);
};

// Silueta de un solo color para el ícono monocromo de Android 13+: círculo con la S calada
const sPath = plano.match(/<path d="([^"]+)"/)[1];
const monocromo = `
  <defs><mask id="m"><rect x="0" y="0" width="1000" height="1000" fill="#fff"/><path d="${sPath}" fill="#000"/></mask></defs>
  <circle cx="500" cy="500" r="500" fill="#ffffff" mask="url(#m)"/>`;

png(lienzo(interior(simbolo), 1024, 0.84, '#ffffff'), 'icon.png');
// Android adaptativo: el sistema recorta el ícono, así que el símbolo va dentro de la zona segura (≈ 61 %)
png(lienzo(interior(simbolo), 1024, 0.6, null), 'android-icon-foreground.png');
png(lienzo('', 1024, 1, '#ffffff'), 'android-icon-background.png');
png(lienzo(monocromo, 1024, 0.6, null), 'android-icon-monochrome.png');
png(lienzo(interior(simbolo), 1024, 1, null), 'splash-icon.png');
png(lienzo(interior(simbolo), 192, 0.92, null), 'favicon.png');

// PWA (app instalable desde el navegador): public/brand/
const brand = path.join(raiz, 'public', 'brand');
fs.mkdirSync(brand, { recursive: true });
const pngWeb = (svg, archivo) => {
  fs.writeFileSync(path.join(brand, archivo), new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng());
  console.log(`✓ public/brand/${archivo}`);
};
pngWeb(lienzo(interior(simbolo), 192, 0.84, '#ffffff'), 'icon-192.png');
pngWeb(lienzo(interior(simbolo), 512, 0.84, '#ffffff'), 'icon-512.png');
// Maskable: Android recorta el ícono en círculo o "squircle"; el símbolo va dentro de la zona segura (80 %)
pngWeb(lienzo(interior(simbolo), 512, 0.66, '#ffffff'), 'icon-maskable-512.png');
// iPhone no admite transparencia en el ícono de la pantalla de inicio
pngWeb(lienzo(interior(simbolo), 180, 0.84, '#ffffff'), 'apple-touch-icon.png');
