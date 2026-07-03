// components/ManualRegistrationModal.tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useContext, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WorkHoursContext } from '../context/WorkHoursContext';


interface ManualRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualRegistrationModal: React.FC<ManualRegistrationModalProps> = ({ isOpen, onClose }) => {
  const { saveDayEntry, currentDate } = useContext(WorkHoursContext) as any;

  // Estados del formulario manual
  const [selectedDay, setSelectedDay] = useState('');
  const [dateObject, setDateObject] = useState(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  // 🕒 INTERRUPTORES DE RECOLECTOR DE HORA NATIVO (PEGA ESTO AQUÍ ABAJO)
  const [startTimeObject, setStartTimeObject] = useState(new Date());
  const [endTimeObject, setEndTimeObject] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  



  // Genera la lista de días del mes actual para el selector desplegable
  const year = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
  const month = currentDate ? currentDate.getMonth() : new Date().getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  
  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const dayNum = i + 1;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  });

  const handleSaveManual = async () => {
    if (!selectedDay) {
      alert('⚠️ Por favor selecciona el día que vas a registrar, mi rey.');
      return;
    }
    if (!startHour || !endHour) {
      alert('⚠️ Por favor digita las horas de Entrada y Salida.');
      return;
    }

    setLoading(true);

    try {
      // 🧮 NORMALIZACIÓN SENIOR: Dejamos las horas limpias sin el texto " manual" para no romper calculateHoursAndNightSplit
      const cleanStart = startHour.trim();
      const cleanEnd = endHour.trim();
      const horaLegible = `${cleanStart} - ${cleanEnd}`;

      // Validamos si la fecha seleccionada cae un día Domingo (0)
      const esDomingo = new Date(selectedDay + 'T00:00:00').getDay() === 0;

      // Estructuramos el payload replicando al milímetro tus campos de 'work_entries'
      const manualPayload = {
        date: selectedDay,
        startTime: cleanStart, // ⏱️ Enviamos la hora limpia para que tu utils.ts calcule perfecto
        endTime: cleanEnd,     // ⏱️ Enviamos la hora limpia para que tu utils.ts calcule perfecto
        isHolidayOrSunday: esDomingo,
        notes: notes.trim() ? `[Ajuste Manual] ${notes.trim()}` : '[Ajuste Manual]',
        marcas: [
          {
            id: `manual-${Date.now()}`,
            tipo: 'MANUAL',
            hora: horaLegible,
            zona: 'Registro Manual',
            timestamp: new Date().toISOString() // Sello de tiempo estándar
          }
        ]
      };

      // Mandamos el paquete directo al Contexto con merge activado
      await saveDayEntry(manualPayload as any);

      alert('¡Registro manual inyectado con éxito en la planilla, mi rey! 🚀');
      
      // Limpiamos el formulario
      setStartHour('');
      setEndHour('');
      setNotes('');
      setSelectedDay('');
      onClose();

    } catch (error) {
      console.error("Error en guardado manual:", error);
      alert('No se pudo guardar el registro manual.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          
          {/* Cabecera */}
          <Text style={styles.modalTitle}>Novedad / Registro Manual</Text>
          <Text style={styles.modalSubtitle}>Agrega un turno fraccionado que olvidaste ponchar</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 10 }}>
            
            {/* 🗓️ DESPLEGABLE / CALENDARIO INTERACTIVO */}
            <Text style={styles.inputLabel}>SELECCIONA EL DÍA DEL MES</Text>
            
            {Platform.OS === 'web' ? (
              <View style={styles.pickerContainer}>
                <select 
                  value={selectedDay} 
                  onChange={(e) => setSelectedDay(e.target.value)}
                  style={styles.webSelect}
                >
                  <option value="">-- Elige una fecha --</option>
                  {daysArray.map((date) => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </View>
            ) : (
              <View>
                {/* En celulares, mostramos un botón elegante con diseño oscuro que despierta el calendario */}
                <TouchableOpacity 
                  onPress={() => setShowAndroidPicker(true)}
                  style={styles.textInput}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: selectedDay ? '#ffffff' : '#4f5d75', fontSize: 14, paddingTop: 10 }}>
                    {selectedDay ? `📅 Fecha seleccionada: ${selectedDay}` : 'Touch para elegir fecha... 📆'}
                  </Text>
                </TouchableOpacity>

                {showAndroidPicker && (
                  <DateTimePicker
                    value={dateObject}
                    mode="date"
                    display="default"
                    // Bloqueamos el calendario para que solo puedan elegir días del mes actual
                    minimumDate={new Date(year, month, 1)}
                    maximumDate={new Date(year, month, totalDaysInMonth)}
                    onChange={(event, date) => {
                      setShowAndroidPicker(false); // Cierra el selector inmediatamente
                      if (date) {
                        setDateObject(date);
                        // Formateamos la fecha nativa a tu texto 'AAAA-MM-DD' de Firebase
                        const formatted = date.toISOString().split('T')[0];
                        setSelectedDay(formatted);
                      }
                    }}
                  />
                )}
              </View>
            )}


                       {/* ⏱️ ENTRADAS DE HORA HÍBRIDAS PREMIUM: SIN RAYITAS Y 100% ABIERTAS */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              
              {/* COLUMNA: HORA ENTRADA */}
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>HORA ENTRADA</Text>
                
                {Platform.OS === 'web' ? (
                  /* 🌐 DISEÑO WEB: Botón estético con reloj nativo oculto por debajo */
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={styles.textInput}
                    onPress={() => {
                      // Truco senior: Despierta el reloj de Chrome por código al tocar el cuadro
                      if (Platform.OS === 'web') {
                        const input = document.getElementById('web-start-time');
                        if (input) (input as any).showPicker();
                      }
                    }}
                  >
                    <Text style={{ color: startHour ? '#ffffff' : '#4f5d75', fontSize: 13, paddingTop: 10, paddingHorizontal: 12 }}>
                      {startHour ? startHour : 'Elegir... 🕒'}
                    </Text>
                    {/* El input real queda invisible pero operativo al 100% para capturar cualquier minuto */}
                    <input 
                      id="web-start-time"
                      type="time" 
                      value={startHour} 
                      onChange={(e) => setStartHour(e.target.value)}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </TouchableOpacity>
                ) : (
                  /* 📱 DISEÑO CELULAR: Reloj nativo flotante de Android/iOS */
                  <View>
                    <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.textInput} activeOpacity={0.7}>
                      <Text style={{ color: startHour ? '#ffffff' : '#4f5d75', fontSize: 13, paddingTop: 10 }}>
                        {startHour ? startHour : 'Elegir... 🕒'}
                      </Text>
                    </TouchableOpacity>

                    {showStartPicker && (
                      <DateTimePicker
                        value={startTimeObject}
                        mode="time"
                        is24Hour={false}
                        display="default"
                        onChange={(event, date) => {
                          setShowStartPicker(false);
                          if (date) {
                            setStartTimeObject(date);
                            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                            setStartHour(formattedTime);
                          }
                        }}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* COLUMNA: HORA SALIDA */}
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>HORA SALIDA</Text>
                
                {Platform.OS === 'web' ? (
                  /* 🌐 DISEÑO WEB */
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={styles.textInput}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        const input = document.getElementById('web-end-time');
                        if (input) (input as any).showPicker();
                      }
                    }}
                  >
                    <Text style={{ color: endHour ? '#ffffff' : '#4f5d75', fontSize: 13, paddingTop: 10, paddingHorizontal: 12 }}>
                      {endHour ? endHour : 'Elegir... 🕒'}
                    </Text>
                    <input 
                      id="web-end-time"
                      type="time" 
                      value={endHour} 
                      onChange={(e) => setEndHour(e.target.value)}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </TouchableOpacity>
                ) : (
                  /* 📱 DISEÑO CELULAR */
                  <View>
                    <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.textInput} activeOpacity={0.7}>
                      <Text style={{ color: endHour ? '#ffffff' : '#4f5d75', fontSize: 13, paddingTop: 10 }}>
                        {endHour ? endHour : 'Elegir... 🕒'}
                      </Text>
                    </TouchableOpacity>

                    {showEndPicker && (
                      <DateTimePicker
                        value={endTimeObject}
                        mode="time"
                        is24Hour={false}
                        display="default"
                        onChange={(event, date) => {
                          setShowEndPicker(false);
                          if (date) {
                            setEndTimeObject(date);
                            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                            setEndHour(formattedTime);
                          }
                        }}
                      />
                    )}
                  </View>
                )}
              </View>

            </View>



            {/* 💬 NOTAS DE JUSTIFICACIÓN */}
            <View>
              <Text style={styles.inputLabel}>JUSTIFICACIÓN / OBSERVACIÓN</Text>
              <TextInput 
                style={[styles.textInput, { height: 70, textAlignVertical: 'top', paddingTop: 8 }]} 
                placeholder="Escribe por qué reportas de forma manual..." 
                placeholderTextColor="#4f5d75"
                multiline={true}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

          </ScrollView>

          {/* Botones de Acción */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity onPress={onClose} style={[styles.actionBtn, styles.btnCancel]}>
              <Text style={styles.btnTextCancel}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleSaveManual} disabled={loading} style={[styles.actionBtn, styles.btnSave]}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnTextSave}>Guardar Registro</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 43, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#0b132b',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#3a4f7c25',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#8d99ae',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8d99ae',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pickerContainer: {
    backgroundColor: '#111936',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a4f7c20',
    overflow: 'hidden',
  },
  webSelect: {
    width: '100%',
    height: 44,
    backgroundColor: '#111936',
    color: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 14,
    // 🌐 EL TRUCO COMPATIBLE: Usamos propiedades estándar que React Native entiende y traduce a la web
    borderWidth: 0,
  },

  textInput: {
    backgroundColor: '#111936',
    color: '#ffffff',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3a4f7c20',
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#1c254140',
    borderWidth: 1,
    borderColor: '#3a4f7c20',
  },
  btnSave: {
    backgroundColor: '#3a86ff',
  },
  btnTextCancel: {
    color: '#8d99ae',
    fontWeight: '600',
    fontSize: 14,
  },
  btnTextSave: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
    webTimeInput: {
    width: '100%',
    height: 44,
    backgroundColor: '#111936',
    color: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3a4f7c20',
    outline: 'none',
  },

});
