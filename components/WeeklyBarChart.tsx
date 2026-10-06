// components/WeeklyBarChart.tsx
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { WeekRange } from '../types/hours';
import { alpha, useTheme } from '../lib/theme';

interface WeeklyBarChartProps {
  weeklyHours: number[];
  weekRanges: WeekRange[];
}

const CONTAINER_HEIGHT = 172;
const PADDING_BOTTOM = 36; // Espacio para la etiqueta S# y el rango de días
const GRAPH_HEIGHT = CONTAINER_HEIGHT - PADDING_BOTTOM;
const GRAPH_WIDTH = 300;
const START_X = 35;
const TOP = 15;

export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({ weeklyHours = [], weekRanges = [] }) => {
  const { colors: c } = useTheme();
  const yAxisMax = Math.ceil(Math.max(...weeklyHours, 10) / 10) * 10;

  // El ancho de cada barra se reparte según cuántas semanas tenga el mes (4 a 6)
  const plotWidth = GRAPH_WIDTH - START_X - 10;
  const slot = plotWidth / Math.max(weeklyHours.length, 1);
  const barWidth = Math.min(28, slot * 0.6);

  return (
    <View style={{ backgroundColor: c.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: alpha(c.borderStrong, 0.13), alignItems: 'center', marginVertical: 12 }}>
      <Text style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: '600', color: c.textMuted, marginBottom: 14 }}>
        DISTRIBUCIÓN SEMANAL (HORAS)
      </Text>

      <Svg height={CONTAINER_HEIGHT} width={GRAPH_WIDTH}>
        <Line x1={START_X} y1={TOP} x2={GRAPH_WIDTH - 10} y2={TOP} stroke={alpha(c.borderStrong, 0.25)} strokeWidth={1} strokeDasharray="4 4" />
        <SvgText x={START_X - 8} y={TOP + 5} fill={c.textMuted} fontSize={11} textAnchor="end">{yAxisMax}h</SvgText>

        <Line x1={START_X} y1={GRAPH_HEIGHT / 2 + 7} x2={GRAPH_WIDTH - 10} y2={GRAPH_HEIGHT / 2 + 7} stroke={alpha(c.borderStrong, 0.25)} strokeWidth={1} strokeDasharray="4 4" />
        <SvgText x={START_X - 8} y={GRAPH_HEIGHT / 2 + 12} fill={c.textMuted} fontSize={11} textAnchor="end">{yAxisMax / 2}h</SvgText>

        <Line x1={START_X} y1={GRAPH_HEIGHT} x2={GRAPH_WIDTH - 10} y2={GRAPH_HEIGHT} stroke={c.borderStrong} strokeWidth={1} />
        <SvgText x={START_X - 8} y={GRAPH_HEIGHT + 4} fill={c.textMuted} fontSize={11} textAnchor="end">0h</SvgText>

        {weeklyHours.map((hours, index) => {
          const barHeight = (hours / yAxisMax) * (GRAPH_HEIGHT - TOP);
          const xPos = START_X + index * slot + (slot - barWidth) / 2;
          const yPos = GRAPH_HEIGHT - barHeight;
          const centerX = xPos + barWidth / 2;
          const range = weekRanges[index];

          return (
            <React.Fragment key={index}>
              <Rect x={xPos} y={TOP} width={barWidth} height={GRAPH_HEIGHT - TOP} fill={c.bg} rx={4} />
              {hours > 0 && <Rect x={xPos} y={yPos} width={barWidth} height={barHeight} fill={c.cyan} rx={4} />}
              {hours > 0 && (
                <SvgText x={centerX} y={yPos - 6} fill={c.text} fontSize={10} fontWeight="600" textAnchor="middle">
                  {hours}
                </SvgText>
              )}
              <SvgText x={centerX} y={GRAPH_HEIGHT + 16} fill={c.textMuted} fontSize={11} fontWeight="500" textAnchor="middle">
                S{index + 1}
              </SvgText>
              {range && (
                <SvgText x={centerX} y={GRAPH_HEIGHT + 30} fill={c.textFaint} fontSize={9} textAnchor="middle">
                  {range.from === range.to ? range.from : `${range.from}-${range.to}`}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};
