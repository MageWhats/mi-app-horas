// components/SelectField.tsx
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { View } from 'react-native';

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

// Selector multiplataforma: en web renderiza un <select>, en Android/iOS el selector nativo.
export const SelectField: React.FC<SelectFieldProps> = ({ value, onChange, options }) => (
  <View style={{ backgroundColor: '#1f2937', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
    <Picker
      selectedValue={value}
      onValueChange={(v) => onChange(String(v))}
      dropdownIconColor="#ffffff"
      style={{ color: '#ffffff', backgroundColor: 'transparent', borderWidth: 0, padding: 12, fontSize: 14 }}
      itemStyle={{ color: '#ffffff', fontSize: 15 }} // Solo iOS (rueda en línea sobre fondo oscuro)
    >
      {options.map((o) => (
        <Picker.Item key={o.value} label={o.label} value={o.value} />
      ))}
    </Picker>
  </View>
);
