import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { ConsentimientoPendiente } from '../../components/ConsentimientoPendiente';
import { TabBarIcon } from '../../components/TabBarIcon';
import { useWorkHours, WorkHoursProvider } from '../../context/WorkHoursContext';
import { useTheme } from '../../lib/theme';

export default function TabLayout() {
  return (
    <WorkHoursProvider>
      <Pestanas />
    </WorkHoursProvider>
  );
}

function Pestanas() {
  const { colors: c } = useTheme();
  const { esSupervisor } = useWorkHours();
  return (
    <>
      <ConsentimientoPendiente />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.textFaint,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarStyle: {
            backgroundColor: c.tabBar,
            borderTopColor: c.border,
            height: Platform.OS === 'web' ? 72 : 64,
            paddingBottom: Platform.OS === 'web' ? 10 : 24,
            paddingTop: 8,
          },
          sceneStyle: { backgroundColor: c.bg },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="summary"
          options={{
            title: 'Resumen',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="equipo"
          options={{
            title: 'Equipo',
            // Solo los supervisores ven esta pestaña
            href: esSupervisor ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
