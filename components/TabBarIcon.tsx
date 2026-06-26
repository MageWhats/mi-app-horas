// components/navigation/TabBarIcon.tsx
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface TabBarIconProps {
  name: string;
  size?: number;
  color: string;
}

const SVG_ICONS: Record<string, string> = {
  'calendar': 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z',
  'calendar-outline': 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-2 5H7v2h10v-2zm-4 4H7v2h6v-2z',
  'bar-chart': 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
  'bar-chart-outline': 'M19 19H5V5h2v12h12v2zm-2-4h2v2h-2v-2zm-4-4h2v6h-2v-6zm-4-4h2v10H9V7z',
  'chevron-back': 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  'chevron-forward': 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  'close': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  // ICONOS NUEVOS PARA LAS TARJETAS:
  'time-outline': 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z',
  'calculator-outline': 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-2-4h-2v2h2v-2zm0-4h-2v2h2v-2zm0-4h-2v2h2V7zm-4 8H7v2h4v-2zm0-4H7v2h4v-2zm0-4H7v2h4V7z',
  'analytics-outline': 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z',
  'moon-outline': 'M12.3 2a10 10 0 0 0-1.9.2 10 10 0 1 1-1.4 16.2A10 10 0 1 0 12.3 2z',
  'trending-up-outline': 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z',
  'information-circle-outline': 'M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'
};

export function TabBarIcon({ name, size = 24, color }: TabBarIconProps) {
  if (Platform.OS === 'web') {
    const pathData = SVG_ICONS[name] || SVG_ICONS['calendar'];
    return (
      <Svg height={size} width={size} viewBox="0 0 24 24">
        <Path d={pathData} fill={color} />
      </Svg>
    );
  }

  return <Ionicons name={name as any} size={size} color={color} />;
}
