// components/RealTimePunch.tsx
import * as Location from 'expo-location';
import React, { useContext, useEffect, useState, } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WorkHoursContext } from '../context/WorkHoursContext'; // Asegúrate de que la ruta apunte a tu Contexto real
import { TabBarIcon } from './TabBarIcon';

export const RealTimePunch: React.FC = () => {
 
    // 🔌 CONEXIÓN BLINDADA: Envolvemos el useContext en ( ... as any) para forzar la lectura de punchInRealTime
  const { entries, punchInRealTime, setGlobalSeconds } = (useContext(WorkHoursContext) as any);


  const [currentStatus, setCurrentStatus] = useState<'FUERA' | 'LABORANDO'>('FUERA');
  const [loading, setLoading] = useState(false);
  const [secondsActive, setSecondsActive] = useState(0);

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  const todayStr = localDate.toISOString().split('T')[0];
  const todayData = entries[todayStr] || null;
  const todayPunches = todayData?.marcas || [];

  // 🛰️ ESCUCHA DE ESTADO DE NUBE: Sincroniza el botón y el cronómetro con Firebase al abrir la app
  useEffect(() => {
    if (todayPunches.length > 0) {
      const ultimaMarca = todayPunches[todayPunches.length - 1];
      if (ultimaMarca.tipo === 'ENTRADA') {
        setCurrentStatus('LABORANDO');
        
        // 🛡️ EL SEGUNDERO AUTOMÁTICO: Crea un bucle continuo de 1 segundo en caliente
        const interval = setInterval(() => {
          const tiempoPasado = Math.floor((Date.now() - new Date(ultimaMarca.timestamp).getTime()) / 1000);
          setSecondsActive(tiempoPasado > 0 ? tiempoPasado : 0);
            // ✨ REGLÓN NUEVO (Pégalo exactamente aquí):
          if (typeof setGlobalSeconds === 'function') {
          setGlobalSeconds(tiempoPasado > 0 ? tiempoPasado : 0);
    }
        }, 1000);

        // Limpiamos el temporizador si el componente se desmonta
        return () => clearInterval(interval);
      } else {
        setCurrentStatus('FUERA');
        setSecondsActive(0);
      }
    } else {
      setCurrentStatus('FUERA');
      setSecondsActive(0);
    }
   }, [todayPunches]);



  // ⏱️ TRADUCTOR GLOBAL DE TIEMPO: Convierte los segundos unificados del Contexto a HH:MM:SS
  const timeString = (() => {
        // Modifica la línea 46 para que quede exactamente así:
    const totalSecs = secondsActive || 0;
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  })();


  // 🔘 ACCIÓN DE PONCHAR CON GPS REAL
  const handlePunchAction = async () => {
    setLoading(true);
    
    try {
      // 1. Forzar petición de coordenadas para auditoría empresarial
      let coords: any = null;
      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          coords = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
              () => resolve(null),
              { enableHighAccuracy: true, timeout: 7000 }
            );
          });
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy };
        }
      }

      // 2. Determinar la acción matemática
      const proximaMarca = currentStatus === 'FUERA' ? 'ENTRADA' : 'SALIDA';

      // 3. Ejecutar el guardado directo en la nube de Firebase
      const resultado = await punchInRealTime(proximaMarca, coords);
      
      if (resultado) {
        alert(`¡Marca de ${proximaMarca} registrada con éxito corporativo!`);
      }
    } catch (e) {
      console.error(e);
      alert('Error en la geolocalización. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      
      {/* 📊 TARJETA DE ESTADO ACTUAL */}
      <View style={styles.statusCard}>
        <Text style={styles.statusSubtitle}>ESTADO DEL OPERARIO</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, currentStatus === 'LABORANDO' ? styles.dotActive : styles.dotInactive]} />
          <Text style={styles.statusTitle}>
            {currentStatus === 'LABORANDO' ? 'Laborando en Turno Activo' : 'Fuera de Servicio / Descanso'}
          </Text>
        </View>
      </View>

      {/* ⏱️ CRONÓMETRO DIGITAL */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>TIEMPO TRANSCURRIDO HOY</Text>
        <Text style={[styles.timerNumbers, currentStatus === 'LABORANDO' ? styles.timerNumbersActive : null]}>
          {timeString}

        </Text>
      </View>

      {/* 🔘 BOTÓN GIGANTE INTERACTIVO */}
      <View style={styles.punchCenter}>
        <TouchableOpacity
          onPress={handlePunchAction}
          disabled={loading}
          activeOpacity={0.8}
          style={[
            styles.punchButton,
            currentStatus === 'LABORANDO' ? styles.punchButtonActive : styles.punchButtonInactive
          ]}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#ffffff" />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <TabBarIcon 
                name={currentStatus === 'LABORANDO' ? 'stop-circle' : 'play-circle'} 
                size={48} 
                color="#ffffff" 
              />
              <Text style={styles.punchButtonText}>
                {currentStatus === 'LABORANDO' ? 'FINALIZAR\nTURNO' : 'INICIAR\nJORNADA'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.punchTip}>
          {currentStatus === 'LABORANDO' ? 'Presiona para registrar tu salida con GPS' : 'Presiona al llegar al frente de trabajo'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b132b',
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#1c254150',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3a4f7c15',
    marginBottom: 20,
  },
  statusSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: '#f97316', // Naranja activo
    shadowColor: '#f97316',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  dotInactive: {
    backgroundColor: '#8d99ae',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 1,
    marginBottom: 4,
  },
  timerNumbers: {
    fontSize: 42,
    fontWeight: '800',
    color: '#3a4f7c',
    fontVariant: ['tabular-nums'], // Mantiene los números fijos sin bailar
  },
  timerNumbersActive: {
    color: '#00f5d4', // Cambia a cian brillante al laborar
  },
  punchCenter: {
    alignItems: 'center',
    marginBottom: 28,
  },
  punchButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  punchButtonInactive: {
    backgroundColor: '#3a86ff',
    borderColor: 'rgba(58, 134, 255, 0.3)',
    shadowColor: '#3a86ff',
  },
  punchButtonActive: {
    backgroundColor: '#f97316',
    borderColor: 'rgba(249, 115, 22, 0.3)',
    shadowColor: '#f97316',
  },
  punchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 6,
    lineHeight: 16,
  },
  punchTip: {
    fontSize: 12,
    color: '#8d99ae',
    marginTop: 12,
    textAlign: 'center',
  },
  historySection: {
    flex: 1,
    backgroundColor: '#1c254130',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a4f7c10',
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  punchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1c254160',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3a4f7c15',
  },
  punchInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeIn: {
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
    borderColor: 'rgba(0, 245, 212, 0.2)',
  },
  badgeOut: {
    backgroundColor: 'rgba(255, 0, 127, 0.08)',
    borderColor: 'rgba(255, 0, 127, 0.2)',
  },
  badgeTextIn: {
    color: '#00f5d4',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextOut: {
    color: '#ff007f',
    fontSize: 10,
    fontWeight: '800',
  },
  punchTimeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  punchInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  punchLocationText: {
    color: '#8d99ae',
    fontSize: 12,
  },
});
