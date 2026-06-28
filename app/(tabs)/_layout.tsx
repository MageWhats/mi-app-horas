import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { TabBarIcon } from '../../components/TabBarIcon'; // NUEVA IMPORTACIÓN
import { UpdateProfileModal } from '../../components/UpdateProfileModal'; // Trae la ventana flotante naranja
import { WorkHoursProvider } from '../../context/WorkHoursContext';
 // @ts-ignore - Apaga temporalmente el chequeo estricto para esta línea en el emulador
import { auth, db } from '../../lib/firebase'; // Tus llaves de Google






export default function TabLayout() {
    // Estados para controlar la ventana flotante naranja de migración
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
     // @ts-ignore - Apaga temporalmente el chequeo estricto para esta línea en el emulador
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
         try {
          // IMPORTACIONES EN CALIENTE PARA EVITAR CHOQUES DE TIPADO
          const { collection, query, where, getDocs } = require('firebase/firestore');
          
          // 🔎 CONSULTA CRUZADA: Busca en la colección si algún usuario tiene este UID registrado
          const q = query(collection(db, 'users'), where('uid', '==', user.uid));
          const querySnapshot = await getDocs(q);
          
          // Si el buscador encuentra el registro, apagamos la alerta naranja para siempre
          if (!querySnapshot.empty) {
            setShowMigrationModal(false);
          } else {
            setShowMigrationModal(true); // Solo salta si es una cuenta vieja sin cédula
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

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
            paddingBottom: Platform.OS === 'web' ? 12 : 24,
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
            {/* ⚠️ LA VENTANA FLOTANTE NARANJA DE MIGRACIÓN CORPORATIVA */}
      {currentUser && (
        <UpdateProfileModal 
          isOpen={showMigrationModal}
          userUid={currentUser.uid}
          userEmail={currentUser.email || ''}
          onUpdateSuccess={() => setShowMigrationModal(false)}
        />
      )}

    </WorkHoursProvider>
  );
}
