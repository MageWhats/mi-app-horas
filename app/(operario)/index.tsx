// app/(operario)/index.tsx
import { TabBarIcon } from "@/components/TabBarIcon";
import { useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HoursInputModal } from "../../components/HoursInputModal";
import { ManualRegistrationModal } from "../../components/ManualRegistrationModal";
import { MonthNavigator } from "../../components/MonthNavigator";
import { formatSeconds, RealTimePunch } from "../../components/RealTimePunch";
import { ScreenContainer } from "../../components/ScreenContainer";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useWorkHours } from "../../context/WorkHoursContext";
import { alpha, Paleta, useTheme, useThemedStyles } from "../../lib/theme";
import { calculateRealtimeHours, toLocalDateStr } from "../../lib/utils";
import { Marca } from "../../types/hours";

export default function RegisterScreen() {
  const { entries, currentDate, globalSeconds, openShift } = useWorkHours();
  const { colors: c } = useTheme();
  const styles = useThemedStyles(crearEstilos);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const todayStr = toLocalDateStr();

  // 🎢 EL CABLE INVISIBLE: Rastreará la posición del dedo en píxeles (ej: 0 a 200px)
  const scrollY = useRef(new Animated.Value(0)).current;

  // 1. ANIMACIÓN DE ALTURA: Se encoge de 450px a solo 60px
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [430, 60],
    extrapolate: "clamp",
  });

  // 2. ANIMACIÓN DE OPACIDAD DEL BOTÓN GIGANTE: Se desvanece al subir el dedo
  const giantButtonOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // 3. ANIMACIÓN DE OPACIDAD DEL MINI CRONÓMETRO: Aparece solo cuando el gigante se oculta
  const miniTimerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Genera los días del mes seleccionado de forma dinámica
  const generateDaysOfMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysArray = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      daysArray.push(dateStr);
    }
    return daysArray;
  };

  const renderDayItem = ({ item: dayStr }: { item: string }) => {
    const dayData = entries[dayStr] || null;
    const isToday = dayStr === todayStr;

    const marcasDelDia: Marca[] = dayData?.marcas ?? [];
    const isCompletado = !!(dayData?.notes || dayData?.isHolidayOrSunday);

    // Horas guardadas del día; si aún no hay total, se estiman de los tramos ENTRADA → SALIDA cerrados
    const tiempoCalculado = dayData?.hours || calculateRealtimeHours(marcasDelDia).totalHours;

    return (
      <TouchableOpacity
        onPress={() => setSelectedDate(dayStr)}
        activeOpacity={0.85}
        style={{
          backgroundColor: isToday ? alpha(c.primary, 0.07) : c.surface,
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          borderWidth: isToday ? 1.5 : 1,
          borderColor: isToday ? c.primary : c.border,
        }}
      >
        {/* FILA SUPERIOR: Número de día y Estado Completado */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: isToday ? c.primary : c.text,
              }}
            >
              {parseInt(dayStr.split("-")[2], 10)}
            </Text>

            {isCompletado && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: alpha(c.cyan, 0.06),
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: alpha(c.cyan, 0.12),
                }}
              >
                <TabBarIcon name="shield-checkmark" size={10} color={c.cyan} />
                <Text
                  style={{
                    fontSize: 9,
                    color: c.cyan,
                    fontWeight: "800",
                    letterSpacing: 0.3,
                  }}
                >
                  COMPLETADO
                </Text>
              </View>
            )}
          </View>

          {dayData?.isHolidayOrSunday && (
            <View
              style={{
                backgroundColor: alpha(c.danger, 0.08),
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text
                style={{ fontSize: 9, color: c.danger, fontWeight: "800" }}
              >
                FESTIVO / DOMINICAL
              </Text>
            </View>
          )}
        </View>

        {/* CONTENEDOR HÍBRIDO (Marcas vs Horas Totales a la Derecha) */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {/* COLUMNA IZQUIERDA: Fracciones de jornada */}
          <View style={{ flex: 1, gap: 4, paddingRight: 12 }}>
            {marcasDelDia.length === 0 ? (
              <Text
                style={{ fontSize: 11, color: c.textFaint, fontStyle: "italic" }}
              >
                Sin marcas de tiempo real
              </Text>
            ) : (
              marcasDelDia.map((punch, idx) => {
                const esEntrada = punch.tipo === "ENTRADA";
                const esManual = punch.tipo === "MANUAL" || punch.tipo === "MANUAL_JORNADA";

                // Normalizamos visualmente cualquier variación para que pinte "Entra" o "Sale"
                const etiquetaTipo = esManual
                  ? "Manual"
                  : esEntrada
                    ? "Entra"
                    : "Sale";
                const horaLimpia = punch.hora
                  ? String(punch.hora).toLowerCase().trim()
                  : "";

                return (
                  <View
                    key={punch.id || idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: esManual
                          ? c.primary
                          : esEntrada
                            ? c.success
                            : c.danger,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        color: c.textMuted,
                        fontWeight: "600",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {etiquetaTipo}: {horaLimpia}
                      {!!punch.motivoSinGps && (
                        <Text style={{ color: c.warning, fontWeight: "800" }}> · sin GPS</Text>
                      )}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* ⏱️ COLUMNA DERECHA FIJA: Cápsula inteligente multi-escala */}

          {marcasDelDia.length > 0 && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {/* Activamos el mapa si alguna marca real tiene coordenadas GPS registradas O si es un registro manual */}
              {(marcasDelDia.some(
                (m) => m.latitude !== undefined && m.latitude !== null,
              ) ||
                marcasDelDia.some((m) => m.tipo === "MANUAL")) && (
                <View
                  style={{
                    // Si alguna marca tiene latitud, asumimos que fue ponchado con GPS (Color Verde/Celeste)
                    backgroundColor: marcasDelDia.some((m) => m.latitude)
                      ? alpha(c.cyan, 0.1)
                      : alpha(c.textMuted, 0.1),
                    paddingHorizontal: 10,
                    paddingVertical: 12.2,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: marcasDelDia.some((m) => m.latitude)
                      ? alpha(c.cyan, 0.2)
                      : alpha(c.textMuted, 0.2),
                    minWidth: 30,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TabBarIcon
                    name="map"
                    size={20}
                    color={
                      marcasDelDia.some((m) => m.latitude)
                        ? c.cyan
                        : c.textMuted
                    }
                  />
                </View>
              )}
              <View
                style={{
                  backgroundColor: alpha(c.cyan, 0.1),
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: alpha(c.cyan, 0.2),
                  minWidth: 55,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {(() => {
                  const totalSegundos = tiempoCalculado * 3600;
                  const totalMinutos = tiempoCalculado * 60;

                  if (totalSegundos <= 0) {
                    // Turno abierto sin tramos cerrados todavía
                    return (
                      <Text style={{ fontSize: 12, color: c.cyan, fontWeight: "800" }}>
                        {openShift?.date === dayStr ? "En curso" : "—"}
                      </Text>
                    );
                  } else if (totalSegundos < 60) {
                    // ⚡ Escala Segundos (Menor a 1 minuto)
                    return (
                      <>
                        <Text
                          style={{
                            fontSize: 14,
                            color: c.cyan,
                            fontWeight: "800",
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {Math.round(totalSegundos)}s
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: c.textMuted,
                            fontWeight: "700",
                            marginTop: 1,
                            textTransform: "lowercase",
                          }}
                        >
                          Total
                        </Text>
                      </>
                    );
                  } else if (tiempoCalculado < 1) {
                    // ⏱️ Escala Minutos (Entre 1 minuto y 1 hora) -> ¡Aquí caerán tus 1m y 10s!
                    return (
                      <>
                        <Text
                          style={{
                            fontSize: 14,
                            color: c.cyan,
                            fontWeight: "800",
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {Math.round(totalMinutos)}m
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: c.textMuted,
                            fontWeight: "700",
                            marginTop: 1,
                            textTransform: "lowercase",
                          }}
                        >
                          Total
                        </Text>
                      </>
                    );
                  } else {
                    // 💼 Escala Horas (Mayor a 1 hora)
                    return (
                      <>
                        <Text
                          style={{
                            fontSize: 14,
                            color: c.cyan,
                            fontWeight: "800",
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {tiempoCalculado.toFixed(1)}h
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: c.textMuted,
                            fontWeight: "700",
                            marginTop: 1,
                            textTransform: "lowercase",
                          }}
                        >
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
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              color: c.textFaint,
              marginTop: 8,
              fontStyle: "italic",
              borderTopWidth: 1,
              borderTopColor: alpha(c.borderStrong, 0.05),
              paddingTop: 4,
            }}
          >
            💬 {dayData.notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenContainer>
        <ScreenHeader />
        {/* 🧥 CONTENEDOR ANIMADO SUPERIOR: Se encoge de 450px a 60px al deslizar el dedo */}
        <Animated.View
          style={{
            height: headerHeight,
            overflow: "hidden",
            backgroundColor: c.bg,
          }}
        >
          {/* VISTA A: El panel gigante con el cronómetro (Se desvanece al subir) */}
          <Animated.View style={{ opacity: giantButtonOpacity, flex: 1 }}>
            <RealTimePunch />
          </Animated.View>

          {/* VISTA B: La barra compacta superior (Aparece solo al encogerse) */}
          <Animated.View
            style={{
              opacity: miniTimerOpacity,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 60,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              backgroundColor: c.surface,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: c.cyan,
                }}
              />
              <Text
                style={{ color: c.text, fontSize: 13, fontWeight: "700" }}
              >
                CRONÓMETRO EN VIVO
              </Text>
            </View>
            <Text
              style={{
                color: c.cyan,
                fontSize: 18,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatSeconds(globalSeconds)}
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
            { useNativeDriver: false }, // Obligatorio en false para animar la altura (height)
          )}
          ListHeaderComponent={
            <View style={{ backgroundColor: c.bg, paddingTop: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: c.textFaint, letterSpacing: 1, marginTop: 4 }}>
                MIS JORNADAS
              </Text>
              {/* El navegador de meses va aquí arriba del primer día de la lista */}
              <MonthNavigator />
            </View>
          }
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
        <Text style={{ color: c.onPrimary, fontSize: 20, fontWeight: "700", marginTop: -2 }}>+</Text>
        <Text style={styles.floatingButtonText}>Registro manual</Text>
      </TouchableOpacity>
    </View>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  floatingButton: {
    position: "absolute",
    bottom: 24,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  floatingButtonText: {
    color: c.onPrimary,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
