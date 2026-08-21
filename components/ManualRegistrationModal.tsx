// components/ManualRegistrationModal.tsx
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WorkHoursContext } from "../context/WorkHoursContext";

interface ManualRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualRegistrationModal: React.FC<ManualRegistrationModalProps> = ({ isOpen, onClose }) => {
  const { saveDayEntry, currentDate } = useContext(WorkHoursContext) as any;

  // Estados del formulario manual existentes
  const [selectedDay, setSelectedDay] = useState("");
  const [dateObject, setDateObject] = useState(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [startHour, setStartHour] = useState("");
  const [endHour, setEndHour] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Selector de hora nativo existente
  const [startTimeObject, setStartTimeObject] = useState(new Date());
  const [endTimeObject, setEndTimeObject] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // NUEVOS ESTADOS SENIOR: Control de modalidad de jornadas
  const [modoRegistro, setModoRegistro] = useState<'HORARIO' | 'JORNADA'>('HORARIO');
  const [horasJornadaDirecta, setHorasJornadaDirecta] = useState('8');
  const [esFestivoJornada, setEsFestivoJornada] = useState(false);

  // Genera la lista de días del mes actual para el selector desplegable
  const year = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
  const month = currentDate ? currentDate.getMonth() : new Date().getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const dayNum = i + 1;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  });

  const handleSaveManual = async () => {
    if (!selectedDay) {
      alert("⚠️ Por favor selecciona el día que vas a registrar.");
      return;
    }

    if (modoRegistro === 'HORARIO' && (!startHour || !endHour)) {
      alert("⚠️ Por favor digita las horas de Entrada y Salida.");
      return;
    }

    if (modoRegistro === 'JORNADA' && (!horasJornadaDirecta || Number(horasJornadaDirecta) <= 0)) {
      alert("⚠️ Por favor ingresa una cantidad válida de horas para la jornada.");
      return;
    }

    setLoading(true);
    try {
      let manualPayload: any = {};
      const esDomingo = new Date(selectedDay + "T00:00:00").getDay() === 0;

      if (modoRegistro === 'HORARIO') {
        const cleanStart = startHour.trim();
        const cleanEnd = endHour.trim();
        const horaLegible = `${cleanStart} - ${cleanEnd}`;

        manualPayload = {
          date: selectedDay,
          startTime: cleanStart,
          endTime: cleanEnd,
          isHolidayOrSunday: esFestivoJornada || esDomingo,
          notes: notes.trim() ? `[Ajuste Manual Horario] ${notes.trim()}` : "[Ajuste Manual Horario]",
          nuevaMarca:{
            id: `manual-${Date.now()}`,
            tipo: "MANUAL",
            hora: horaLegible,
            horaIngreso: cleanStart,
            horaSalida: cleanEnd,
            zona: "Registro Manual",
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        // MODO JORNADA DIRECTA: Inyecta las horas netas sin cálculos de reloj
        const horasNetas = Number(horasJornadaDirecta);
        manualPayload = {
          date: selectedDay,
          totalHours: horasNetas, // El motor de tu nomina.tsx leerá esto directo
          isHolidayOrSunday: esFestivoJornada || esDomingo, // Si activa el botón o es domingo, se marca festivo
          notes: notes.trim() ? `[Jornada Directa: ${horasNetas}h] ${notes.trim()}` : `[Jornada Directa: ${horasNetas}h]`,
          marcas: [
            {
              id: `jornada-${Date.now()}`,
              tipo: "MANUAL_JORNADA",
              hora: `${horasNetas} Horas Netas`,
              zona: "Registro Jornada Faena",
              totalHours: horasNetas,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }

      await saveDayEntry(manualPayload as any);
      alert("¡Registro manual inyectado con éxito en la planilla, mi rey! 🚀");

      // Limpiamos el formulario
      setStartHour("");
      setEndHour("");
      setHorasJornadaDirecta("8");
      setEsFestivoJornada(false);
      setNotes("");
      setSelectedDay("");
      onClose();
    } catch (error) {
      console.error("Error en guardado manual:", error);
      alert("No se pudo guardar el registro manual.");
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
          <Text style={styles.modalSubtitle}>Agrega un turno fraccionado o una jornada directa de faena</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 10 }}>

            {/* SWITCH SELECTOR DE MODALIDAD (ESTÉTICA INTEGRADA DE TUS PANELES) */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setModoRegistro('HORARIO')}
                style={[styles.tabBtn, { backgroundColor: modoRegistro === 'HORARIO' ? '#3a86ff' : '#111936' }]}
              >
                <Text style={{ color: '#ffffff', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>Por Horario</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setModoRegistro('JORNADA')}
                style={[styles.tabBtn, { backgroundColor: modoRegistro === 'JORNADA' ? '#3a86ff' : '#111936' }]}
              >
                <Text style={{ color: '#ffffff', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>Por Jornada Directa</Text>
              </TouchableOpacity>
            </View>

            {/* SELECCIONA EL DÍA DEL MES (COMÚN PARA AMBOS MODOS) */}
            <View>
              <Text style={styles.inputLabel}>SELECCIONA EL DÍA DEL MES</Text>
              {Platform.OS === "web" ? (
                <View style={styles.pickerContainer}>
                  <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} style={styles.webSelect}>
                    <option value="">-- Elige una fecha --</option>
                    {daysArray.map((date) => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </View>
              ) : (
                <View>
                  <TouchableOpacity onPress={() => setShowAndroidPicker(true)} style={styles.textInput} activeOpacity={0.7}>
                    <Text style={{ color: selectedDay ? "#ffffff" : "#4f5d75", fontSize: 14, paddingTop: 10 }}>
                      {selectedDay ? `📆 Fecha seleccionada: ${selectedDay}` : "Touch para elegir fecha... "}
                    </Text>
                  </TouchableOpacity>
                  {showAndroidPicker && (
                    <DateTimePicker
                      value={dateObject}
                      mode="date"
                      display="default"
                      minimumDate={new Date(year, month, 1)}
                      maximumDate={new Date(year, month, totalDaysInMonth)}
                      onChange={(event, date) => {
                        setShowAndroidPicker(false);
                        if (date) {
                          setDateObject(date);
                          const formatted = date.toISOString().split("T")[0];
                          setSelectedDay(formatted);
                        }
                      }}
                    />
                  )}
                </View>
              )}
            </View>

            {/* INTERFAZ CONDICIONAL 1: POR HORARIO (RELOJ ORIGINAL) */}
            {modoRegistro === 'HORARIO' && (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>HORA ENTRADA</Text>
                  {Platform.OS === "web" ? (
                    <TouchableOpacity activeOpacity={0.8} style={styles.textInput} onPress={() => {
                      const input = document.getElementById("web-start-time");
                      if (input) (input as any).showPicker();
                    }}>
                      <Text style={{ color: startHour ? "#ffffff" : "#4f5d75", fontSize: 13, paddingTop: 10, paddingHorizontal: 12 }}>
                        {startHour ? startHour : "Elegir... "}
                      </Text>
                      <input id="web-start-time" type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} style={styles.hiddenWebTime} />
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.textInput} activeOpacity={0.7}>
                        <Text style={{ color: startHour ? "#ffffff" : "#4f5d75", fontSize: 13, paddingTop: 10 }}>{startHour ? startHour : "Elegir... "}</Text>
                      </TouchableOpacity>
                      {showStartPicker && (
                        <DateTimePicker value={startTimeObject} mode="time" is24Hour={false} display="default" onChange={(event, date) => {
                          setShowStartPicker(false);
                          if (date) {
                            setStartTimeObject(date);
                            const formattedTime = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
                            setStartHour(formattedTime);
                          }
                        }} />
                      )}
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>HORA SALIDA</Text>
                  {Platform.OS === "web" ? (
                    <TouchableOpacity activeOpacity={0.8} style={styles.textInput} onPress={() => {
                      const input = document.getElementById("web-end-time");
                      if (input) (input as any).showPicker();
                    }}>
                      <Text style={{ color: endHour ? "#ffffff" : "#4f5d75", fontSize: 13, paddingTop: 10, paddingHorizontal: 12 }}>
                        {endHour ? endHour : "Elegir... "}
                      </Text>
                      <input id="web-end-time" type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} style={styles.hiddenWebTime} />
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.textInput} activeOpacity={0.7}>
                        <Text style={{ color: endHour ? "#ffffff" : "#4f5d75", fontSize: 13, paddingTop: 10 }}>{endHour ? endHour : "Elegir... "}</Text>
                      </TouchableOpacity>
                      {showEndPicker && (
                        <DateTimePicker value={endTimeObject} mode="time" is24Hour={false} display="default" onChange={(event, date) => {
                          setShowEndPicker(false);
                          if (date) {
                            setEndTimeObject(date);
                            const formattedTime = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
                            setEndHour(formattedTime);
                          }
                        }} />
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* INTERFAZ CONDICIONAL 2: POR JORNADA DIRECTA */}
            {modoRegistro === 'JORNADA' && (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={styles.inputLabel}>CANTIDAD DE HORAS DE LA JORNADA / MAREA</Text>
                  <TextInput
                    value={horasJornadaDirecta}
                    onChangeText={(txt) => setHorasJornadaDirecta(txt.replace(/[^0-9.]/g, ''))}
                    keyboardType="numeric"
                    style={styles.textInput}
                    placeholder="Ej: 12"
                    placeholderTextColor="#4f5d75"
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setEsFestivoJornada(!esFestivoJornada)}
                  style={{
                    backgroundColor: esFestivoJornada ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                    borderWidth: 1,
                    borderColor: esFestivoJornada ? '#f59e0b' : '#3a4f7c40',
                    height: 44,
                    borderRadius: 12,
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ color: esFestivoJornada ? '#f59e0b' : '#8d99ae', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
                    {esFestivoJornada ? '✓ JORNADA EN DOMINGO / FESTIVO (RECARGO +80%)' : '+ ¿LA JORNADA FUE UN DOMINGO O FESTIVO?'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* NOTAS DE JUSTIFICACIÓN */}
            <View>
              <Text style={styles.inputLabel}>JUSTIFICACIÓN / OBSERVACIÓN</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: "top", paddingTop: 8 }]}
                placeholder="Escribe detalles de la faena o por qué reportas manual..."
                placeholderTextColor="#4f5d75"
                multiline={true}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Botones de Acción */}
          {/* --- ASÍ DEBEN QUEDAR TUS BOTONES DE ACCIÓN (PÁGINA 14) --- */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>

            {/* Botón 1: Cancelar */}
            <TouchableOpacity onPress={onClose} style={[styles.actionBtn, styles.btnCancel]}>
              <Text style={styles.btnTextCancel}>Cancelar</Text>
            </TouchableOpacity>

            {/* Botón 2: Guardar */}
            <TouchableOpacity onPress={handleSaveManual} disabled={loading} style={[styles.actionBtn, styles.btnSave]}>
              {/* Aquí va la corrección del Error 2 */}
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.btnTextSave}>Guardar Registro</Text>
              )}
            </TouchableOpacity>

          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(11, 19, 43, 0.85)", justifyContent: "center", alignItems: "center", padding: 20, },
  modalContainer: { backgroundColor: "#0b132b", borderRadius: 24, padding: 20, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: "#3a4f7c25", maxHeight: "90%", },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#ffffff", textAlign: "center", },
  modalSubtitle: { fontSize: 12, color: "#8d99ae", textAlign: "center", marginTop: 4, marginBottom: 20, },
  inputLabel: { fontSize: 10, fontWeight: "700", color: "#8d99ae", letterSpacing: 0.5, marginBottom: 6, },
  pickerContainer: { backgroundColor: "#111936", borderRadius: 12, borderWidth: 1, borderColor: "#3a4f7c20", overflow: "hidden", },
  webSelect: { width: "100%", height: 44, backgroundColor: "#111936", color: "#ffffff", paddingHorizontal: 12, fontSize: 14, borderWidth: 0, },
  textInput: { backgroundColor: "#111936", color: "#ffffff", height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, borderWidth: 1, borderColor: "#3a4f7c20", },
  tabBtn: { flex: 1, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#3a4f7c15" },
  actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", },
  btnCancel: { backgroundColor: "#1c254140", borderWidth: 1, borderColor: "#3a4f7c20", },
  btnSave: { backgroundColor: "#3a86ff", },
  btnTextCancel: { color: "#8d99ae", fontWeight: "600", fontSize: 14, },
  btnTextSave: { color: "#ffffff", fontWeight: "700", fontSize: 14, },
  hiddenWebTime: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", }
}
);
