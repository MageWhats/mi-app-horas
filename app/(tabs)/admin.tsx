import { useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function AdminScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#090d16" }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 40,
        width: "100%",
      }}
    >
      {/* Cabecera del Panel */}
      <View style={{ marginBottom: 32 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            color: "#ffffff",
            letterSpacing: -0.5,
            marginBottom: 4,
          }}
        >
          PANEL GERENCIAL GENERAL
        </Text>
        <Text style={{ fontSize: 14, color: "#9ca3af" }}>
          Mar Profundo — Control de Operations
        </Text>
      </View>

      {/* Contenedor de Botones Grandes con navegación nativa */}
      <View style={{ width: "100%" }}>
        {/* Botón Nómina */}
        <TouchableOpacity
          onPress={() => router.replace("/admins/nomina")}
          style={{
            width: "100%",
            padding: 20,
            borderRadius: 16,
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            borderColor: "rgba(59, 130, 246, 0.4)",
            borderWidth: 1,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: 6,
            }}
          >
            Gestión de Nómina
          </Text>
          <Text style={{ fontSize: 13, color: "#9ca3af", lineHeight: 18 }}>
            Control de operarios, liquidación de horas y asistencia.
          </Text>
        </TouchableOpacity>

        {/* Botón Inventario */}
        <TouchableOpacity
          onPress={() => router.replace("/admins/inventario")}
          style={{
            width: "100%",
            padding: 20,
            borderRadius: 16,
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            borderColor: "rgba(16, 185, 129, 0.4)",
            borderWidth: 1,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: 6,
            }}
          >
            Control de Inventario
          </Text>
          <Text style={{ fontSize: 13, color: "#9ca3af", lineHeight: 18 }}>
            Próximamente: Monitoreo de insumos, herramientas y stock de la
            empresa.
          </Text>
        </TouchableOpacity>

        {/* Botón Contabilidad */}
        <TouchableOpacity
          onPress={() => router.replace("/admins/contabilidad")}
          style={{
            width: "100%",
            padding: 20,
            borderRadius: 16,
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderColor: "rgba(245, 158, 11, 0.4)",
            borderWidth: 1,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: 6,
            }}
          >
            Contabilidad General
          </Text>
          <Text style={{ fontSize: 13, color: "#9ca3af", lineHeight: 18 }}>
            Próximamente: Balances financieros, costos fijos e ingresos
            generales.
          </Text>
        </TouchableOpacity>

        {/* Botón Roles */}
        <TouchableOpacity
          onPress={() => router.replace("/admins/maestros")}
          style={{
            width: "100%",
            padding: 20,
            borderRadius: 16,
            backgroundColor: "rgba(168, 85, 247, 0.12)",
            borderColor: "rgba(168, 85, 247, 0.4)",
            borderWidth: 1,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: 6,
            }}
          >
            Asignación de Roles
          </Text>
          <Text style={{ fontSize: 13, color: "#9ca3af", lineHeight: 18 }}>
            Modifica los permisos de acceso y roles del personal directamente.
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
