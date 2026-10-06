// components/brand/Logo.tsx
// Logos vectoriales de Net&Sec (originales en branding/). El texto se pinta según el tema.
import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { Paleta, useTheme } from '../../lib/theme';
import { LOGO_COMPLETO_XML, LOGO_HORIZONTAL_XML, SIMBOLO_XML } from './logos.generated';

// Proporciones de los viewBox originales (ancho / alto)
const PROPORCION_COMPLETO = 1110 / 1450;
const PROPORCION_HORIZONTAL = 1830 / 680;

const pintar = (xml: string, c: Pick<Paleta, 'logoTexto' | 'logoSubtexto' | 'logoEslogan'>) =>
  xml
    .replaceAll('__TEXTO__', c.logoTexto)
    .replaceAll('__SUBTEXTO__', c.logoSubtexto)
    .replaceAll('__ESLOGAN__', c.logoEslogan);

/** Solo el símbolo (la S en el círculo). No depende del tema. */
export const Simbolo: React.FC<{ size: number }> = ({ size }) => (
  <SvgXml xml={SIMBOLO_XML} width={size} height={size} />
);

interface LogoProps {
  height: number;
  /** Fuerza los colores de una paleta concreta (p. ej. la animación de entrada, siempre oscura). */
  paleta?: Paleta;
}

/** Símbolo, "Net&Sec SUMINISTROS" y eslogan, en vertical (pantalla de inicio de sesión). */
export const LogoCompleto: React.FC<LogoProps> = ({ height, paleta }) => {
  const { colors } = useTheme();
  const c = paleta ?? colors;
  const xml = useMemo(() => pintar(LOGO_COMPLETO_XML, c), [c]);
  return <SvgXml xml={xml} width={height * PROPORCION_COMPLETO} height={height} />;
};

/** Símbolo a la izquierda y nombre a la derecha (encabezados). */
export const LogoHorizontal: React.FC<LogoProps> = ({ height, paleta }) => {
  const { colors } = useTheme();
  const c = paleta ?? colors;
  const xml = useMemo(() => pintar(LOGO_HORIZONTAL_XML, c), [c]);
  return <SvgXml xml={xml} width={height * PROPORCION_HORIZONTAL} height={height} />;
};
