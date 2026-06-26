const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Envuelve la configuración por defecto con el motor de NativeWind
module.exports = withNativeWind(config, { input: "./global.css" });
