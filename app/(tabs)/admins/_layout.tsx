import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#090d16' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="nomina" options={{ title: 'Gestión de Nómina' }} />
      <Stack.Screen name="inventario" options={{ title: 'Control de Inventario' }} />
      <Stack.Screen name="contabilidad" options={{ title: 'Contabilidad General' }} />
      <Stack.Screen name="roles" options={{ title: 'Asignación de Roles' }} />
    </Stack>
  );
}
