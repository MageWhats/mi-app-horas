// lib/alert.ts
// Alert.alert no hace nada en react-native-web, así que en web usamos los diálogos del navegador.
import { Alert, Platform } from 'react-native';

export const mostrarAlerta = (titulo: string, mensaje?: string) => {
  if (Platform.OS === 'web') {
    window.alert(mensaje ? `${titulo}: ${mensaje}` : titulo);
  } else {
    Alert.alert(titulo, mensaje);
  }
};

export const confirmar = (titulo: string, mensaje: string, textoConfirmar = 'Aceptar'): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoConfirmar, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
};
