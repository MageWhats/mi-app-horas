// components/SelectField.tsx
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { View } from 'react-native';
import { useFormTheme } from './form/theme';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  hasError?: boolean;
}

// Lista desplegable multiplataforma: en web renderiza un <select>, en Android/iOS el selector nativo.
export const SelectField: React.FC<SelectFieldProps> = ({ value, onChange, options, placeholder, hasError }) => {
  const { c, inputBox } = useFormTheme();
  return (
  <View style={[inputBox(hasError), { overflow: 'hidden' }]}>
    <Picker
      selectedValue={value}
      onValueChange={(v) => onChange(String(v))}
      dropdownIconColor={c.text}
      style={{ color: value ? c.text : c.placeholder, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 8, minHeight: 46, fontSize: 15 }}
      itemStyle={{ color: c.text, fontSize: 15 }} // Solo iOS (rueda sobre fondo oscuro)
    >
      {placeholder !== undefined && <Picker.Item label={placeholder} value="" color={c.placeholder} />}
      {options.map((o) => (
        <Picker.Item key={o.value} label={o.label} value={o.value} />
      ))}
    </Picker>
  </View>
  );
};
