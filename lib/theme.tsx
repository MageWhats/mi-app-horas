// lib/theme.tsx
// Tema claro / oscuro con la paleta de Net&Sec. Sigue al sistema hasta que el usuario elige uno con el botón,
// y esa elección se recuerda entre sesiones.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ModoTema = 'claro' | 'oscuro';

export interface Paleta {
  bg: string;            // Fondo de pantalla
  surface: string;       // Tarjetas
  surfaceAlt: string;    // Elementos elevados dentro de tarjetas
  input: string;         // Cajas de texto
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  placeholder: string;
  primary: string;       // Azul Net&Sec: botones y resaltados
  onPrimary: string;
  cyan: string;          // Acento del logo
  success: string;
  danger: string;
  warning: string;
  info: string;
  tabBar: string;
  overlay: string;
  // Colores del texto del logo (el símbolo no cambia)
  logoTexto: string;
  logoSubtexto: string;
  logoEslogan: string;
}

const OSCURO: Paleta = {
  bg: '#0b0f19',
  surface: '#121824',
  surfaceAlt: '#1a2232',
  input: '#0f1522',
  border: '#1e293b',
  borderStrong: '#2b3a52',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  placeholder: '#475569',
  primary: '#0772c7',
  onPrimary: '#ffffff',
  cyan: '#00b4f0',
  success: '#10b981',
  danger: '#f43f5e',
  warning: '#f97316',
  info: '#3b82f6',
  tabBar: '#0e1320',
  overlay: 'rgba(0, 0, 0, 0.65)',
  logoTexto: '#ffffff',
  logoSubtexto: '#cbd5e1',
  logoEslogan: '#ffffff',
};

const CLARO: Paleta = {
  bg: '#f3f5f9',
  surface: '#ffffff',
  surfaceAlt: '#eef2f7',
  input: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  textFaint: '#64748b',
  placeholder: '#94a3b8',
  primary: '#0772c7',
  onPrimary: '#ffffff',
  cyan: '#0369a1',
  success: '#047857',
  danger: '#dc2626',
  warning: '#c2410c',
  info: '#1d4ed8',
  tabBar: '#ffffff',
  overlay: 'rgba(15, 23, 42, 0.45)',
  logoTexto: '#042a67',
  logoSubtexto: '#3b4f7d',
  logoEslogan: '#1e5ea8',
};

/** Paleta fija de la animación de entrada: siempre oscura, igual que el splash nativo. */
export const PALETA_OSCURA = OSCURO;

/** "#0772c7" + 0.15 → "rgba(7, 114, 199, 0.15)" */
export const alpha = (hex: string, opacidad: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacidad})`;
};

const CLAVE = 'netsec-horas:tema';

interface ThemeContextType {
  modo: ModoTema;
  colors: Paleta;
  esOscuro: boolean;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sistema = useColorScheme();
  const [elegido, setElegido] = useState<ModoTema | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((v) => { if (v === 'claro' || v === 'oscuro') setElegido(v); })
      .catch(() => undefined); // Sin almacenamiento: se sigue al sistema
  }, []);

  const modo: ModoTema = elegido ?? (sistema === 'light' ? 'claro' : 'oscuro');

  const alternarTema = useCallback(() => {
    const siguiente: ModoTema = modo === 'oscuro' ? 'claro' : 'oscuro';
    setElegido(siguiente);
    AsyncStorage.setItem(CLAVE, siguiente).catch(() => undefined);
  }, [modo]);

  const value = useMemo(() => ({
    modo,
    colors: modo === 'oscuro' ? OSCURO : CLARO,
    esOscuro: modo === 'oscuro',
    alternarTema,
  }), [modo, alternarTema]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return context;
};

/**
 * Estilos que dependen del tema, recalculados solo cuando cambia la paleta.
 * Uso: const styles = useThemedStyles((c) => StyleSheet.create({ ... }));
 */
export const useThemedStyles = <T,>(crear: (c: Paleta) => T): T => {
  const { colors } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => crear(colors), [colors]);
};
