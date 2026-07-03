// app/(tabs)/index.tsx
import { Stack } from 'expo-router';

import { TabBarIcon } from '@/components/TabBarIcon';
import { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HoursInputModal } from '../../components/HoursInputModal';
import { ManualRegistrationModal } from '../../components/ManualRegistrationModal';
import { MonthNavigator } from '../../components/MonthNavigator';
import { RealTimePunch } from '../../components/RealTimePunch';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useWorkHours } from '../../context/WorkHoursContext';


export default function RegisterScreen() {
  const { entries, currentDate, globalSeconds } = useWorkHours() as any; // 🔌 CONEXIÓN BLINDADA: Envolvemos el useContext en ( ... as any) para forzar la lectura de entries y currentDate
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  


    // 🎢 EL CABLE INVISIBLE: Rastreará la posición del dedo en píxeles (ej: 0 a 200px)
  const scrollY = useRef(new Animated.Value(0)).current;

  // 1. ANIMACIÓN DE ALTURA: Se encoge de 460px a solo 60px
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [450, 60],
    extrapolate: 'clamp',
  });

  // 2. ANIMACIÓN DE OPACIDAD DEL BOTÓN GIGANTE: Se desvanece al subir el dedo
  const giantButtonOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // 3. ANIMACIÓN DE OPACIDAD DEL MINI CRONÓMETRO: Aparece solo cuando el gigante se oculta
  const miniTimerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });


  // Genera los días del mes seleccionado de forma dinámica
  const generateDaysOfMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysArray = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysArray.push(dateStr);
    }
    return daysArray;
  };
/*
  // Función para capturar la fecha exacta de hoy al presionar el botón flotante
  const openTodayModal = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };
*/

  const renderDayItem = ({ item: dayStr }: { item: string }) => {
    const dayData = (entries[dayStr] || null) as any;
    const isToday = dayStr === new Date().toISOString().split('T')[0];
    
    const marcasDelDia = dayData?.marcas && Array.isArray(dayData.marcas) ? dayData.marcas : [];
    const isCompletado = !!(dayData?.notes || dayData?.isHolidayOrSunday);

    // 🧮 CALCULADORA MULTI-TRAMOS DE ENTRADAS Y SALIDAS (AVANZA DE 2 EN 2)
    const tiempoCalculado = (() => {
      let totalSegundosDelDia = 0;
      
      if (marcasDelDia.length >= 2) {
        // Avanzamos i += 2 para saltar limpiamente de pareja en pareja (Entrada + Salida)
        for (let i = 0; i < marcasDelDia.length; i += 2) {
          const marcaEntrada = marcasDelDia[i];
          const marcaSalida = marcasDelDia[i + 1];

          // Validamos que existan ambos tramos y correspondan al flujo correcto
          if (marcaEntrada && marcaSalida && marcaEntrada.tipo === 'ENTRADA' && marcaSalida.tipo === 'SALIDA') {
            const t1 = new Date(marcaEntrada.timestamp).getTime();
            const t2 = new Date(marcaSalida.timestamp).getTime();
            
            if (!isNaN(t1) && !isNaN(t2)) {
              totalSegundosDelDia += (t2 - t1) / 1000; // Sumamos los segundos puros trabajados
            }
          }
        }
      }
      
      // Convertimos el total de segundos a horas decimales para mantener simetría
      return totalSegundosDelDia > 0 ? (totalSegundosDelDia / 3600) : (dayData?.hours || 0);
    })();

    return (
      <TouchableOpacity
        onPress={() => setSelectedDate(dayStr)}
        activeOpacity={0.85}
        style={{
          backgroundColor: isToday ? '#1c2541' : isCompletado ? '#111936aa' : '#111936',
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: isToday ? '#00f5d440' : isCompletado ? 'rgba(0, 245, 212, 0.15)' : 'rgba(58, 79, 124, 0.15)',
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {/* FILA SUPERIOR: Número de día y Estado Completado */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: isToday ? '#00f5d4' : '#ffffff' }}>
              {parseInt(dayStr.split('-')[2], 10)}
            </Text>
            
            {isCompletado && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0, 245, 212, 0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0, 245, 212, 0.12)' }}>
                <TabBarIcon name="shield-checkmark" size={10} color="#00f5d4" />
                <Text style={{ fontSize: 9, color: '#00f5d4', fontWeight: '800', letterSpacing: 0.3 }}>COMPLETADO</Text>
              </View>
            )}
          </View>

          {dayData?.isHolidayOrSunday && (
            <View style={{ backgroundColor: 'rgba(255, 0, 127, 0.08)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 9, color: '#ff007f', fontWeight: '800' }}>FESTIVO / DOMINICAL</Text>
            </View>
          )}
        </View>

        {/* CONTENEDOR HÍBRIDO (Marcas vs Horas Totales a la Derecha) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          
          {/* COLUMNA IZQUIERDA: Fracciones de jornada */}
          <View style={{ flex: 1, gap: 4, paddingRight: 12 }}>
            {marcasDelDia.length === 0 ? (
              <Text style={{ fontSize: 11, color: '#4f5d75', fontStyle: 'italic' }}>Sin marcas de tiempo real</Text>
            ) : (
              marcasDelDia.map((punch: any, idx: number) => {
                const esEntrada = punch.tipo === 'ENTRADA';
                const esManual = punch.tipo === 'MANUAL';
                
                // Normalizamos visualmente cualquier variación para que pinte "Entra" o "Sale"
                const etiquetaTipo = esManual ? 'Manual' : esEntrada ? 'Entra' : 'Sale';
                const horaLimpia = punch.hora ? String(punch.hora).toLowerCase().trim() : '';

                return (
                  <View key={punch.id || idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: 3, 
                      backgroundColor: esManual ? '#3a86ff' : esEntrada ? '#00f5d4' : '#ff007f' 
                    }} />
                    <Text style={{ fontSize: 11, color: '#8d99ae', fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                      {etiquetaTipo}: {horaLimpia}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* ⏱️ COLUMNA DERECHA FIJA: Cápsula inteligente multi-escala */}
          {marcasDelDia.length > 0 || (dayData?.hours && dayData.hours > 0) && (
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {dayData?.location && (
              <View style={{ backgroundColor: 'rgba(0, 245, 212, 0.1)', paddingHorizontal: 10,paddingVertical: 12.2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0, 245, 212, 0.2)',minWidth: 40,  alignItems: 'center', justifyContent: 'center' }}>
                <TabBarIcon name="map" size={20} color="#00f5d4" />
              </View>
            )}
            <View style={{ 
              backgroundColor: 'rgba(0, 245, 212, 0.1)', 
              paddingHorizontal: 10, 
              paddingVertical: 6, 
              borderRadius: 10, 
              borderWidth: 1, 
              borderColor: 'rgba(0, 245, 212, 0.2)', 
              minWidth: 55, 
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(() => {
                const totalSegundos = tiempoCalculado * 3600;
                const totalMinutos = tiempoCalculado * 60;
                
                if (totalSegundos < 60) {
                  // ⚡ Escala Segundos (Menor a 1 minuto)
                  return (
                    <>
                      <Text style={{ fontSize: 14, color: '#00f5d4', fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                        {Math.max(1, Math.round(totalSegundos))}s
                      </Text>
                      <Text style={{ fontSize: 10, color: '#8d99ae', fontWeight: '700', marginTop: 1, textTransform: 'lowercase' }}>
                        Total
                      </Text>
                    </>
                  );
                } else if (tiempoCalculado < 1) {
                  // ⏱️ Escala Minutos (Entre 1 minuto y 1 hora) -> ¡Aquí caerán tus 1m y 10s!
                  return (
                    <>
                      <Text style={{ fontSize: 14, color: '#00f5d4', fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                        {Math.round(totalMinutos)}m
                      </Text>
                      <Text style={{ fontSize: 10, color: '#8d99ae', fontWeight: '700', marginTop: 1, textTransform: 'lowercase' }}>
                        Total
                      </Text>
                    </>
                  );
                } else {
                  // 💼 Escala Horas (Mayor a 1 hora)
                  return (
                    <>
                      <Text style={{ fontSize: 14, color: '#00f5d4', fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                        {tiempoCalculado.toFixed(1)}h
                      </Text>
                      <Text style={{ fontSize: 10, color: '#8d99ae', fontWeight: '700', marginTop: 1, textTransform: 'lowercase' }}>
                        Total
                      </Text>
                    </>
                  );
                }
              })()}
            </View>
          </View>
  
          )}

        </View>

        {dayData?.notes && (
          <Text numberOfLines={1} style={{ fontSize: 11, color: '#4f5d75', marginTop: 8, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: 'rgba(58, 79, 124, 0.05)', paddingTop: 4 }}>
            💬 {dayData.notes}
          </Text>
        )}

      </TouchableOpacity>
    );
  };





  return (
    <View style={{ flex: 1, backgroundColor: '#0b132b' }}>
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: false }} />

        {/* 🧥 CONTENEDOR ANIMADO SUPERIOR: Se encoge de 500px a 60px al deslizar el dedo */}
        <Animated.View style={{ height: headerHeight, overflow: 'hidden', backgroundColor: '#0b132b', borderBottomWidth: 1, borderBottomColor: '#1c2541' }}>
          
          {/* VISTA A: El panel gigante con el cronómetro (Se desvanece al subir) */}
          <Animated.View style={{ opacity: giantButtonOpacity, flex: 1 }}>
            <RealTimePunch />
          </Animated.View>

          {/* VISTA B: La barra compacta superior (Aparece solo al encogerse) */}
          <Animated.View style={{ opacity: miniTimerOpacity, position: 'absolute', top: 0, left: 0, right: 0, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#1c2541' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00f5d4' }} />
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>CRONÓMETRO EN VIVO</Text>
            </View>
            <Text style={{ color: '#00f5d4', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>

               {globalSeconds > 0 ? (() => {
               const hrs = Math.floor(globalSeconds / 3600);
               const mins = Math.floor((globalSeconds % 3600) / 60);
               const secs = globalSeconds % 60;
               return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
               })() : "00:00:00"}



            </Text>
          </Animated.View>

        </Animated.View>

        {/* 🗓️ LISTA ANIMADA COORDINADA CON EL MOVIMIENTO DEL DEDO */}
        <Animated.FlatList<string>
          data={generateDaysOfMonth()}
          keyExtractor={(item) => item}
          renderItem={renderDayItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }} // Más espacio para que no tape el botón flotante
          scrollEventThrottle={16} // Captura el movimiento a 60 cuadros por segundo para máxima suavidad
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false } // Obligatorio en false para animar la altura (height)
          )}
          ListHeaderComponent={() => (
            <View style={{ backgroundColor: '#0b132b', paddingTop: 12 }}>
              {/* CABECERA PREMIUM */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>Registro</Text>
              </View>
              {/* El navegador de meses va aquí arriba del primer día de la lista */}
              <MonthNavigator />
            </View>
          )}
        />

        <HoursInputModal
          isOpen={selectedDate !== null}
          onClose={() => setSelectedDate(null)}
          dateStr={selectedDate}
        />
          
          {/* 🚨 NUEVO MODAL DE NOVEDADES MANUALES CON SELECTOR DE FECHA */}
        <ManualRegistrationModal 
          isOpen={isManualOpen}
          onClose={() => setIsManualOpen(false)}
        />

      </ScreenContainer>

      {/* BOTÓN FLOTANTE TOTALMENTE REESTRUCTURADO ABAJO A LA DERECHA */}
      <TouchableOpacity 
        onPress={() => setIsManualOpen(true)} // <-- Abre el nuevo módulo manual
        activeOpacity={0.85}
        style={styles.floatingButton}
      >
        <Text style={styles.floatingButtonText}>Registro Manual</Text>
      </TouchableOpacity>
    </View>
  );

}

// 2. EL DICCIONARIO DE ESTILOS QUE HACÍA FALTA ABAJO DEL TODO
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: '#0b132b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#1c2541',
    borderWidth: 1,
    borderColor: '#3a4f7c30',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#3a86ff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 999,
  },
  floatingButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  }
});
