// components/form/SearchSelectField.tsx
import React, { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TabBarIcon } from '../TabBarIcon';
import { useFormTheme } from './theme';

/** Minúsculas y sin tildes, para buscar "bogota" y encontrar "Bogotá". */
const normalizar = (texto: string) => {
  const base = typeof texto.normalize === 'function' ? texto.normalize('NFD').replace(/[̀-ͯ]/g, '') : texto;
  return base.toLowerCase().trim();
};

interface SearchSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  title?: string;
  hasError?: boolean;
}

/** Lista desplegable con buscador. Si la opción no existe, permite usar el texto escrito. */
export const SearchSelectField: React.FC<SearchSelectFieldProps> = ({
  value, onChange, options, placeholder = 'Selecciona…', title = 'Buscar', hasError,
}) => {
  const { c, inputBox, inputText } = useFormTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtradas = useMemo(() => {
    const q = normalizar(query);
    return q ? options.filter((o) => normalizar(o).includes(q)) : options;
  }, [query, options]);

  const textoLibre = query.trim();
  const mostrarTextoLibre = textoLibre.length > 1 && !options.some((o) => normalizar(o) === normalizar(textoLibre));

  const elegir = (opcion: string) => {
    onChange(opcion);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[inputBox(hasError), { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 }]}
      >
        <Text numberOfLines={1} style={[inputText, { flex: 1, color: value ? c.text : c.placeholder }]}>
          {value || placeholder}
        </Text>
        <TabBarIcon name="chevron-forward" size={18} color={c.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}
        >
          <View style={{
            backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16,
            height: '80%', width: '100%', maxWidth: 600, alignSelf: 'center',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 6 }}>
                <TabBarIcon name="close" size={22} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[inputBox(), { marginBottom: 10 }]}>
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Escribe para buscar…"
                placeholderTextColor={c.placeholder}
                autoCorrect={false}
                style={[inputText, { minHeight: 46, ...({ outlineStyle: 'none' } as object) }]}
              />
            </View>

            <FlatList
              data={filtradas}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={mostrarTextoLibre ? (
                <TouchableOpacity onPress={() => elegir(textoLibre)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>Usar «{textoLibre}»</Text>
                </TouchableOpacity>
              ) : null}
              ListEmptyComponent={!mostrarTextoLibre ? (
                <Text style={{ color: c.textFaint, textAlign: 'center', marginTop: 20 }}>Sin resultados</Text>
              ) : null}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => elegir(item)}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <Text style={{ color: item === value ? c.primary : c.text, fontSize: 15 }}>{item}</Text>
                  {item === value && <TabBarIcon name="shield-checkmark" size={16} color={c.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};
