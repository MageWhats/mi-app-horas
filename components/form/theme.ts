// components/form/theme.ts
import { useMemo } from 'react';
import { TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';

/** Paleta del tema actual y estilos base de las cajas de los formularios. */
export const useFormTheme = () => {
  const { colors: c } = useTheme();
  return useMemo(() => ({
    c,
    inputBox: (hasError?: boolean): ViewStyle => ({
      backgroundColor: c.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: hasError ? c.danger : c.borderStrong,
      minHeight: 50,
      justifyContent: 'center',
    }),
    inputText: { color: c.text, fontSize: 15, paddingHorizontal: 14 } as TextStyle,
  }), [c]);
};
