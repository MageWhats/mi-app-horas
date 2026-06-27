// components/MonthNavigator.tsx
import { signOut } from 'firebase/auth';
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useWorkHours } from '../context/WorkHoursContext';
 // @ts-ignore - Apaga temporalmente el chequeo estricto para esta línea en el emulador
import { auth } from '../lib/firebase';


import { TabBarIcon } from './TabBarIcon'; // Sistema de iconos vectoriales SVG

export const MonthNavigator: React.FC = () => {
  const { currentDate, goToPrevMonth, goToNextMonth } = useWorkHours();
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Función para desconectar al usuario de la nube de Google
  const handleSignOut = async () => {
    try {
      // @ts-ignore - Apaga temporalmente el chequeo estricto para esta línea en el emulador
      await signOut(auth);
      
      if (Platform.OS === 'web') {
        alert('Sesión cerrada correctamente.');
      }
    } catch (error) {
      console.error("Error al cerrar sesión: ", error);
    }
  };


  return (
        // Cambiamos paddingVertical a 6 para pegar el mes a las tarjetas
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 4, backgroundColor: '#0b132b' }}>
      {/* Botón de Mes Anterior */}
      <TouchableOpacity onPress={goToPrevMonth} style={{ padding: 8, borderRadius: 9999, backgroundColor: '#1c2541' }}>
        <TabBarIcon name="chevron-back" size={20} color="#ffffff" />
      </TouchableOpacity>

      {/* Bloque Central: Mes, Año y Botón de Salida */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>
          {months[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>

        {/* Botón discreto de Cerrar Sesión estilo Mar Profundo */}
        <TouchableOpacity 
          onPress={handleSignOut} 
          activeOpacity={0.7}
          style={{ padding: 6, borderRadius: 8, backgroundColor: '#1c2541', borderWidth: 1, borderColor: '#ff007f30' }}
        >
          {/* Usamos el vector close como salida temporal o el mapeado en tu TabBarIcon */}
          <TabBarIcon name="close" size={16} color="#ff007f" />
        </TouchableOpacity>
      </View>

      {/* Botón de Mes Siguiente */}
      <TouchableOpacity onPress={goToNextMonth} style={{ padding: 8, borderRadius: 9999, backgroundColor: '#1c2541' }}>
        <TabBarIcon name="chevron-forward" size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
};
