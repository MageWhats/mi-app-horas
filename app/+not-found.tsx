import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { Simbolo } from '../components/brand/Logo';
import { useTheme } from '../lib/theme';

export default function NotFoundScreen() {
  const { colors: c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: c.bg, gap: 16 }}>
      <Simbolo size={72} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>Esta pantalla no existe.</Text>
      <Link href="/" style={{ paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.primary }}>Volver al inicio</Text>
      </Link>
    </View>
  );
}
