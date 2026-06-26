import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { TabBarIcon } from '../../components/TabBarIcon'; // NUEVA IMPORTACIÓN
import { WorkHoursProvider } from '../../context/WorkHoursContext';

export default function TabLayout() {
  return (
    <WorkHoursProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#00b4d8',
          tabBarInactiveTintColor: '#5c677d',
          tabBarStyle: {
            backgroundColor: '#0b132b',
            borderTopColor: '#1c2541',
            height: Platform.OS === 'web' ? 90 : 64,
            paddingBottom: Platform.OS === 'web' ? 32 : 10,
            paddingTop: 10,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Registro',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'calendar' : 'calendar-outline'} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="summary"
          options={{
            title: 'Resumen',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color as string} />
            ),
          }}
        />
      </Tabs>
    </WorkHoursProvider>
  );
}
