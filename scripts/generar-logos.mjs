// scripts/generar-logos.mjs
// Convierte los SVG de branding/ en un módulo TypeScript que la app dibuja con react-native-svg (SvgXml).
// Los colores del texto se reemplazan por marcadores para pintarlos según el tema (claro u oscuro).
// Uso: node scripts/generar-logos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (archivo) => fs.readFileSync(path.join(raiz, 'branding', archivo), 'utf8');

/** Quita el <title>, los saltos de línea y la indentación para reducir el tamaño del bundle */
const compactar = (svg) => svg.replace(/<title>[\s\S]*?<\/title>/, '').replace(/\n\s*/g, '').trim();

/** Colores del texto en la versión a color → marcadores que se rellenan según el tema */
const MARCADORES = {
  '#042a67': '__TEXTO__',    // "Net&Sec"
  '#3b4f7d': '__SUBTEXTO__', // "SUMINISTROS"
  '#1e5ea8': '__ESLOGAN__',  // "Más que productos, soluciones para ti"
};
const tematizar = (svg) =>
  Object.entries(MARCADORES).reduce((acc, [color, marcador]) => acc.replaceAll(`fill="${color}"`, `fill="${marcador}"`), svg);

const logos = {
  SIMBOLO_XML: compactar(leer('simbolo.svg')),
  LOGO_COMPLETO_XML: tematizar(compactar(leer('logo-color.svg'))),
  LOGO_HORIZONTAL_XML: tematizar(compactar(leer('logo-horizontal-color.svg'))),
};

const contenido = [
  '// ARCHIVO GENERADO por scripts/generar-logos.mjs a partir de branding/. No editar a mano.',
  '/* eslint-disable */',
  ...Object.entries(logos).map(([nombre, xml]) => `export const ${nombre} = ${JSON.stringify(xml)};`),
  '',
].join('\n');

const destino = path.join(raiz, 'components', 'brand', 'logos.generated.ts');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, contenido);
console.log(`✓ ${path.relative(raiz, destino)} (${(contenido.length / 1024).toFixed(1)} KB)`);
