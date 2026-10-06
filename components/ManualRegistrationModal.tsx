// components/ManualRegistrationModal.tsx
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
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
import { useWorkHours } from "../context/WorkHoursContext";
import { mostrarAlerta } from "../lib/alert";
import { getRecargoDominical, toLocalDateStr } from "../lib/utils";
import { alpha, Paleta, useTheme, useThemedStyles } from "../lib/theme";

interface ManualRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualRegistrationModal: React.FC<ManualRegistrationModalProps> = ({ isOpen, onClose }) => {
  const { colors: c } = useTheme();
  const styles = useThemedStyles(crearEstilos);
  const { addManualEntry, currentDate } = useWorkHours();

  // Formulario
  const [selectedDay, setSelectedDay] = useState("");
  const [dateObject, setDateObject] = useState(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [startHour, setStartHour] = useState("");
  const [endHour, setEndHour] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Selectores de hora nativos (Android/iOS)
  const [startTimeObject, setStartTimeObject] = useState(new Date());
  const [endTimeObject, setEndTimeObject] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Modalidad: por horario (entrada y salida) o por jornada directa (horas netas)
  const [modoRegistro, setModoRegistro] = useState<'HORARIO' | 'JORNADA'>('HORARIO');
  const [horasJornadaDirecta, setHorasJornadaDirecta] = useState('8');
  const [esFestivoJornada, setEsFestivoJornada] = useState(false);

  // Genera la lista de días del mes actual para el selector desplegable
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const dayNum = i + 1;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  });

  const resetForm = () => {
    setStartHour("");
    setEndHour("");
    setHorasJornadaDirecta("8");
    setEsFestivoJornada(false);
    setNotes("");
    setSelectedDay("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSaveManual = async () => {
    if (!selectedDay) {
      mostrarAlerta("Selecciona el día que vas a registrar.");
      return;
    }

    const horasNetas = Number(horasJornadaDirecta);
    if (modoRegistro === 'HORARIO' && (!startHour || !endHour)) {
      mostrarAlerta("Digita las horas de entrada y salida.");
      return;
    }
    if (modoRegistro === 'HORARIO' && startHour.trim() === endHour.trim()) {
      mostrarAlerta("La hora de entrada y la de salida no pueden ser iguales.");
      return;
    }
    if (modoRegistro === 'JORNADA' && (!horasNetas || horasNetas <= 0 || horasNetas > 24)) {
      mostrarAlerta("Ingresa una cantidad válida de horas (entre 0 y 24).");
      return;
    }

    setLoading(true);
    try {
      const esDomingo = new Date(selectedDay + "T00:00:00").getDay() === 0;
      const isHolidayOrSunday = esFestivoJornada || esDomingo;
      const extra = notes.trim() ? ` ${notes.trim()}` : "";

      if (modoRegistro === 'HORARIO') {
        await addManualEntry(
          selectedDay,
          { mode: 'HORARIO', startTime: startHour.trim(), endTime: endHour.trim() },
          { isHolidayOrSunday, notes: `[Ajuste Manual Horario]${extra}` },
        );
      } else {
        await addManualEntry(
          selectedDay,
          { mode: 'JORNADA', hours: horasNetas },
          { isHolidayOrSunday, notes: `[Jornada Directa: ${horasNetas}h]${extra}` },
        );
      }

      mostrarAlerta("Registro manual guardado");
      handleClose();
    } catch (error) {
      console.error("Error en guardado manual:", error);
      mostrarAlerta("No se pudo guardar el registro manual", "Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Cabecera */}
          <Text style={styles.modalTitle}>Novedad / Registro Manual</Text>
          <Text style={styles.modalSubtitle}>Agrega un turno fraccionado o una jornada directa de faena</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 10 }}>

            {/* Selector de modalidad */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setModoRegistro('HORARIO')}
                style={[styles.tabBtn, { backgroundColor: modoRegistro === 'HORARIO' ? c.primary : c.surfaceAlt }]}
              >
                <Text style={{ color: modoRegistro === 'HORARIO' ? c.onPrimary : c.text, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>Por Horario</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setModoRegistro('JORNADA')}
                style={[styles.tabBtn, { backgroundColor: modoRegistro === 'JORNADA' ? c.primary : c.surfaceAlt }]}
              >
                <Text style={{ color: modoRegistro === 'JORNADA' ? c.onPrimary : c.text, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>Por Jornada Directa</Text>
              </TouchableOpacity>
            </View>

            {/* Día del mes (común a ambas modalidades) */}
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
                    <Text style={{ color: selectedDay ? c.text : c.textFaint, fontSize: 14, paddingTop: 10 }}>
                      {selectedDay ? `📆 Fecha seleccionada: ${selectedDay}` : "Toca para elegir la fecha..."}
                    </Text>
                  </TouchableOpacity>
                  {showAndroidPicker && (
                    <DateTimePicker
                      value={dateObject}
                      mode="date"
                      display="default"
                      minimumDate={new Date(year, month, 1)}
                      maximumDate={new Date(year, month, totalDaysInMonth)}
                      onChange={(_event, date) => {
                        setShowAndroidPicker(false);
                        if (date) {
                          setDateObject(date);
                          setSelectedDay(toLocalDateStr(date));
                        }
                      }}
                    />
                  )}
                </View>
              )}
            </View>

            {/* Modalidad por horario */}
            {modoRegistro === 'HORARIO' && (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>HORA ENTRADA</Text>
                  {Platform.OS === "web" ? (
                    <TouchableOpacity activeOpacity={0.8} style={styles.textInput} onPress={() => {
                      const input = document.getElementById("web-start-time");
                      if (input) (input as any).showPicker();
                    }}>
                      <Text style={{ color: startHour ? c.text : c.textFaint, fontSize: 13, paddingTop: 10, paddingHorizontal: 12 }}>
                        {startHour ? startHour : "Elegir... "}
                      </Text>
                      <input id="web-start-time" type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} style={styles.hiddenWebTime} />
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.textInput} activeOpacity={0.7}>
                        <Text style={{ color: startHour ? c.text : c.textFaint, fontSize: 13, paddingTop: 10 }}>{startHour ? startHour : "Elegir... "}</Text>
                      </TouchableOpacity>
                      {showStartPicker && (
                        <DateTimePicker value={startTimeObject} mode="time" is24Hour={false} display="default" onChange={(_event, date) => {
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
                      <Text style={{ color: endHour ? c.text : c.textFaint, fontSize: 13, paddingTop: 10, paddingHorizontal: 12 }}>
                        {endHour ? endHour : "Elegir... "}
                      </Text>
                      <input id="web-end-time" type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} style={styles.hiddenWebTime} />
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.textInput} activeOpacity={0.7}>
                        <Text style={{ color: endHour ? c.text : c.textFaint, fontSize: 13, paddingTop: 10 }}>{endHour ? endHour : "Elegir... "}</Text>
                      </TouchableOpacity>
                      {showEndPicker && (
                        <DateTimePicker value={endTimeObject} mode="time" is24Hour={false} display="default" onChange={(_event, date) => {
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

            {/* Modalidad por jornada directa */}
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
                    placeholderTextColor={c.textFaint}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setEsFestivoJornada(!esFestivoJornada)}
                  style={{
                    backgroundColor: esFestivoJornada ? alpha(c.warning, 0.12) : 'transparent',
                    borderWidth: 1,
                    borderColor: esFestivoJornada ? c.warning : alpha(c.borderStrong, 0.25),
                    height: 44,
                    borderRadius: 12,
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ color: esFestivoJornada ? c.warning : c.textMuted, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
                    {esFestivoJornada ? `✓ JORNADA EN DOMINGO / FESTIVO (RECARGO +${getRecargoDominical(selectedDay || toLocalDateStr())}%)` : '+ ¿LA JORNADA FUE UN DOMINGO O FESTIVO?'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Justificación */}
            <View>
              <Text style={styles.inputLabel}>JUSTIFICACIÓN / OBSERVACIÓN</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: "top", paddingTop: 8 }]}
                placeholder="Escribe detalles de la faena o por qué reportas manual..."
                placeholderTextColor={c.textFaint}
                multiline={true}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Botones de Acción */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>

            {/* Botón 1: Cancelar */}
            <TouchableOpacity onPress={handleClose} style={[styles.actionBtn, styles.btnCancel]}>
              <Text style={styles.btnTextCancel}>Cancelar</Text>
            </TouchableOpacity>

            {/* Botón 2: Guardar */}
            <TouchableOpacity onPress={handleSaveManual} disabled={loading} style={[styles.actionBtn, styles.btnSave]}>
              {loading ? (
                <ActivityIndicator color={c.onPrimary} />
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

const crearEstilos = (c: Paleta) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: alpha(c.bg, 0.85), justifyContent: "center", alignItems: "center", padding: 20, },
  modalContainer: { backgroundColor: c.bg, borderRadius: 24, padding: 20, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.15), maxHeight: "90%", },
  modalTitle: { fontSize: 18, fontWeight: "800", color: c.text, textAlign: "center", },
  modalSubtitle: { fontSize: 12, color: c.textMuted, textAlign: "center", marginTop: 4, marginBottom: 20, },
  inputLabel: { fontSize: 10, fontWeight: "700", color: c.textMuted, letterSpacing: 0.5, marginBottom: 6, },
  pickerContainer: { backgroundColor: c.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.13), overflow: "hidden", },
  webSelect: { width: "100%", height: 44, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: 12, fontSize: 14, borderWidth: 0, },
  textInput: { backgroundColor: c.surfaceAlt, color: c.text, height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.13), },
  tabBtn: { flex: 1, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: alpha(c.borderStrong, 0.08) },
  actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", },
  btnCancel: { backgroundColor: alpha(c.surface, 0.25), borderWidth: 1, borderColor: alpha(c.borderStrong, 0.13), },
  btnSave: { backgroundColor: c.primary, },
  btnTextCancel: { color: c.textMuted, fontWeight: "600", fontSize: 14, },
  btnTextSave: { color: c.onPrimary, fontWeight: "700", fontSize: 14, },
  hiddenWebTime: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", }
}
);
