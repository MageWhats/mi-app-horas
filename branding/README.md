# Identidad de Net&Sec Suministros

Archivos **vectoriales** del logo (los mismos del proyecto de inventario): se pueden ampliar a cualquier tamaño
sin perder nitidez. Se abren en Illustrator, Inkscape, Figma, Canva, CorelDRAW o en el navegador.

| Archivo | Uso |
|---|---|
| `logo-color.svg` | Logo principal (símbolo, nombre y eslogan) sobre fondos claros |
| `logo-blanco.svg` | Mismo logo con el texto en blanco, para fondos oscuros |
| `logo-horizontal-color.svg` | Símbolo a la izquierda y nombre a la derecha, para encabezados |
| `logo-horizontal-blanco.svg` | Versión horizontal sobre fondos oscuros |
| `simbolo.svg` | Solo el símbolo: íconos, sellos, animación de entrada |
| `simbolo-plano.svg` | Símbolo sin sombreado 3D: tamaños muy pequeños, bordado, vinilo de corte |
| `eslogan-blanco.svg` | Solo el eslogan en blanco |

## Cómo los usa la app

- **Logos en pantalla** → `components/brand/logos.generated.ts`, generado con `node scripts/generar-logos.mjs`.
  Se usa una sola versión de cada logo y el color del texto cambia según el tema (azul en claro, blanco en oscuro).
- **Ícono, splash y favicon** → `assets/images/*.png`, generados desde `simbolo.svg` con
  `node scripts/generar-iconos.mjs` (requiere `npm i -D @resvg/resvg-js`).

Si cambias un SVG de esta carpeta, vuelve a ejecutar los dos scripts.

## Colores

| Color | Hex | Dónde |
|---|---|---|
| Azul marino | `#042A67` | "Net" y "Sec" |
| Azul | `#069EE9` | "&" |
| Gris azulado | `#3B4F7D` | "SUMINISTROS" |
| Azul eslogan | `#1E5EA8` | Eslogan |
| Cian del símbolo | `#19C1F7` → `#002154` | Degradado del símbolo |
| Azul de la app | `#0772C7` | Botones y resaltados |

Tipografías del logo: Montserrat (nombre) y Kaushan Script (eslogan), ambas libres (SIL Open Font License).
