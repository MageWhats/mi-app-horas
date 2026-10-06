// components/PaginaLegal.tsx
// Estructura de las páginas públicas de texto (política de privacidad, eliminación de cuenta).
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { LogoHorizontal } from './brand/Logo';
import { TabBarIcon } from './TabBarIcon';
import { ThemeToggle } from './ThemeToggle';

export const PaginaLegal: React.FC<{ titulo: string; subtitulo?: string; children: React.ReactNode }> = ({ titulo, subtitulo, children }) => {
  const router = useRouter();
  const { colors: c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 44, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
            accessibilityLabel="Volver"
            style={{ padding: 8, marginLeft: -8 }}
          >
            <TabBarIcon name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <LogoHorizontal height={28} />
          <ThemeToggle />
        </View>
        <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{titulo}</Text>
        {!!subtitulo && <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4, marginBottom: 8 }}>{subtitulo}</Text>}
        {children}
      </ScrollView>
    </View>
  );
};

export const Seccion: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => {
  const { colors: c } = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>{titulo}</Text>
      {children}
    </View>
  );
};

export const Parrafo: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors: c } = useTheme();
  return <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>{children}</Text>;
};

export const Lista: React.FC<{ items: React.ReactNode[] }> = ({ items }) => {
  const { colors: c } = useTheme();
  return (
    <View style={{ marginBottom: 8 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <Text style={{ color: c.primary, fontSize: 14, lineHeight: 22 }}>•</Text>
          <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 22, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
};

export const Fuerte: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors: c } = useTheme();
  return <Text style={{ color: c.text, fontWeight: '700' }}>{children}</Text>;
};
