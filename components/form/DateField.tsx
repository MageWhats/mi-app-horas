// components/form/DateField.tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../lib/theme';
import { toLocalDateStr } from '../../lib/utils';
import { TabBarIcon } from '../TabBarIcon';
import { useFormTheme } from './theme';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "1995-08-14" → "14 de agosto de 1995" */
export const formatFechaLarga = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

interface DateFieldProps {
  value: string;               // AAAA-MM-DD o ''
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Fecha en la que se abre el calendario cuando aún no hay valor (p. ej. hace 30 años para un nacimiento). */
  initialDate?: Date;
  hasError?: boolean;
}

export const DateField: React.FC<DateFieldProps> = ({
  value, onChange, placeholder = 'Selecciona la fecha', minimumDate, maximumDate, initialDate, hasError,
}) => {
  const { c, inputBox, inputText } = useFormTheme();
  const { esOscuro } = useTheme();
  const [open, setOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date | null>(null);

  const current = value ? new Date(value + 'T00:00:00') : initialDate ?? maximumDate ?? new Date();

  // Web: calendario nativo del navegador
  if (Platform.OS === 'web') {
    return (
      <View style={inputBox(hasError)}>
        <input
          type="date"
          value={value}
          min={minimumDate ? toLocalDateStr(minimumDate) : undefined}
          max={maximumDate ? toLocalDateStr(maximumDate) : undefined}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: 'transparent', border: 'none', outline: 'none', color: value ? c.text : c.placeholder,
            fontSize: 15, padding: '12px', colorScheme: esOscuro ? 'dark' : 'light', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
          }}
        />
      </View>
    );
  }

  const trigger = (
    <TouchableOpacity
      onPress={() => { setIosDraft(current); setOpen(true); }}
      activeOpacity={0.7}
      style={[inputBox(hasError), { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 }]}
    >
      <Text style={[inputText, { color: value ? c.text : c.placeholder }]}>
        {value ? formatFechaLarga(value) : placeholder}
      </Text>
      <TabBarIcon name="calendar-outline" size={18} color={c.textMuted} />
    </TouchableOpacity>
  );

  // Android: diálogo nativo que se cierra solo al elegir
  if (Platform.OS === 'android') {
    return (
      <>
        {trigger}
        {open && (
          <DateTimePicker
            value={current}
            mode="date"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event, date) => {
              setOpen(false);
              if (event.type === 'set' && date) onChange(toLocalDateStr(date));
            }}
          />
        )}
      </>
    );
  }

  // iOS: rueda dentro de una hoja inferior con botón "Listo"
  return (
    <>
      {trigger}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (iosDraft) onChange(toLocalDateStr(iosDraft));
                  setOpen(false);
                }}
              >
                <Text style={{ color: c.primary, fontSize: 16, fontWeight: '700' }}>Listo</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={iosDraft ?? current}
              mode="date"
              display="spinner"
              locale="es-CO"
              themeVariant={esOscuro ? 'dark' : 'light'}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={(_event, date) => date && setIosDraft(date)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};
