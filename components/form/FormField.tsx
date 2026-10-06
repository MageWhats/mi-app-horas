// components/form/FormField.tsx
import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { TabBarIcon } from '../TabBarIcon';
import { useFormTheme } from './theme';

interface FormFieldProps {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

/** Etiqueta + control + mensaje de ayuda o de error debajo del campo. */
export const FormField: React.FC<FormFieldProps> = ({ label, optional, hint, error, children }) => {
  const { c } = useFormTheme();
  return (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
      {label}
      {optional && <Text style={{ color: c.textFaint, fontWeight: '400' }}> (opcional)</Text>}
    </Text>
    {children}
    {error ? (
      <Text style={{ color: c.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
    ) : hint ? (
      <Text style={{ color: c.textFaint, fontSize: 12, marginTop: 4 }}>{hint}</Text>
    ) : null}
  </View>
  );
};

interface TextFieldProps extends TextInputProps {
  hasError?: boolean;
  /** Nombre de ícono a la izquierda (p. ej. "card-outline") */
  icon?: string;
  right?: React.ReactNode;
}

/** Caja de texto con el estilo del formulario, ícono opcional a la izquierda y adorno a la derecha. */
export const TextField = React.forwardRef<TextInput, TextFieldProps>(({ hasError, icon, right, style, ...props }, ref) => {
  const { c, inputBox, inputText } = useFormTheme();
  return (
  <View style={[inputBox(hasError), { flexDirection: 'row', alignItems: 'center' }]}>
    {icon && (
      <View style={{ paddingLeft: 14 }}>
        <TabBarIcon name={icon} size={18} color={hasError ? c.danger : c.textFaint} />
      </View>
    )}
    <TextInput
      ref={ref}
      placeholderTextColor={c.placeholder}
      // minWidth 0: en web el <input> tiene un ancho mínimo propio y se desborda en filas de dos campos
      style={[inputText, { flex: 1, minWidth: 0, minHeight: 46, ...({ outlineStyle: 'none' } as object) }, style]}
      {...props}
    />
    {right}
  </View>
  );
});
TextField.displayName = 'TextField';

/** Campo de contraseña con el ojo para mostrar u ocultar lo escrito. */
export const PasswordField = React.forwardRef<TextInput, Omit<TextFieldProps, 'secureTextEntry' | 'right'>>((props, ref) => {
  const { c } = useFormTheme();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      right={(
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          hitSlop={8}
          style={{ paddingHorizontal: 14, paddingVertical: 12 }}
        >
          <TabBarIcon name={visible ? 'eye-off' : 'eye'} size={20} color={visible ? c.primary : c.textFaint} />
        </TouchableOpacity>
      )}
    />
  );
});
PasswordField.displayName = 'PasswordField';
