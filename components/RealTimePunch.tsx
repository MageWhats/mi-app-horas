// components/RealTimePunch.tsx
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GeoCoords, useWorkHours } from '../context/WorkHoursContext';
import { mostrarAlerta } from '../lib/alert';
import { toLocalDateStr } from '../lib/utils';
import { TabBarIcon } from './TabBarIcon';

export const formatSeconds = (totalSecs: number) => {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const obtenerUbicacion = async (): Promise<GeoCoords | null> => {
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 7000 }
      );
    });
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy };
};

export const RealTimePunch: React.FC = () => {
  const { openShift, globalSeconds, punchInRealTime } = useWorkHours();
  const [loading, setLoading] = useState(false);

  // El estado se deriva del turno abierto guardado en la nube (puede venir de ayer)
  const currentStatus = openShift ? 'LABORANDO' : 'FUERA';
  const turnoDesdeAyer = !!openShift && openShift.date !== toLocalDateStr();
  const timeString = formatSeconds(globalSeconds);

  const handlePunchAction = async () => {
    setLoading(true);

    try {
      // Si el GPS falla la marca se registra igual, sin coordenadas
      const coords = await obtenerUbicacion().catch((e) => {
        console.warn('No se pudo obtener la ubicación:', e);
        return null;
      });

      const marca = await punchInRealTime(coords);
      mostrarAlerta(`Marca de ${marca} registrada`, coords ? undefined : 'Se guardó sin ubicación GPS.');
    } catch (e) {
      console.error('Error en el ponchador de tiempo real:', e);
      mostrarAlerta('No se pudo registrar la marca', 'Revisa tu conexión e inténtalo de nuevo.');
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
        <Text style={styles.timerLabel}>
          {turnoDesdeAyer ? 'TURNO NOCTURNO (INICIADO AYER)' : 'TIEMPO DEL TURNO ACTUAL'}
        </Text>
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
});
