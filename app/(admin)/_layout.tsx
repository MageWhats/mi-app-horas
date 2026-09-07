import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#090d16' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="nomina" />
      <Stack.Screen name="inventario" />
      <Stack.Screen name="contabilidad"/>
      <Stack.Screen name="maestros"/>
    </Stack>
  );
}
