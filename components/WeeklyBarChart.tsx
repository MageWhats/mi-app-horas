// components/WeeklyBarChart.tsx
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

interface WeeklyBarChartProps {
  weeklyHours: number[];
}

export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({ weeklyHours = [] }) => {
  const containerHeight = 160;
  const paddingBottom = 24;
  const graphHeight = containerHeight - paddingBottom;
  const graphWidth = 300;

  const maxHoursInMonth = Math.max(...weeklyHours, 10); 
  const yAxisMax = Math.ceil(maxHoursInMonth / 10) * 10;

  const barWidth = 28;
  const gap = 24;
  const startX = 35;

  return (
    <View style={{ backgroundColor: '#1c2541', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#3a4f7c20', alignItems: 'center', marginVertical: 12 }}>
      <Text style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: '600', color: '#8d99ae', marginBottom: 14 }}>
        DISTRIBUCIÓN SEMANAL (HORAS)
      </Text>

      <Svg height={containerHeight} width={graphWidth}>
        <Line x1={startX} y1={15} x2={graphWidth - 10} y2={15} stroke="#3a4f7c40" strokeWidth={1} strokeDasharray="4 4" />
        <SvgText x={startX - 8} y={20} fill="#8d99ae" fontSize={11} textAnchor="end">{yAxisMax}h</SvgText>

        <Line x1={startX} y1={graphHeight / 2 + 7} x2={graphWidth - 10} y2={graphHeight / 2 + 7} stroke="#3a4f7c40" strokeWidth={1} strokeDasharray="4 4" />
        <SvgText x={startX - 8} y={graphHeight / 2 + 12} fill="#8d99ae" fontSize={11} textAnchor="end">{yAxisMax / 2}h</SvgText>

        <Line x1={startX} y1={graphHeight} x2={graphWidth - 10} y2={graphHeight} stroke="#3a4f7c" strokeWidth={1} />
        <SvgText x={startX - 8} y={graphHeight + 4} fill="#8d99ae" fontSize={11} textAnchor="end">0h</SvgText>

        {weeklyHours.map((hours: number, index: number) => {

          const barHeight = (hours / yAxisMax) * (graphHeight - 15);
          const xPos = startX + index * (barWidth + gap) + 8;
          const yPos = graphHeight - barHeight;

          return (
            <React.Fragment key={index}>
              <Rect x={xPos} y={15} width={barWidth} height={graphHeight - 15} fill="#0b132b" rx={4} />
              {hours > 0 && <Rect x={xPos} y={yPos} width={barWidth} height={barHeight} fill="#00b4d8" rx={4} />}
              {hours > 0 && (
                <SvgText x={xPos + barWidth / 2} y={yPos - 6} fill="#ffffff" fontSize={10} fontWeight="600" textAnchor="middle">
                  {hours}
                </SvgText>
              )}
              <SvgText x={xPos + barWidth / 2} y={graphHeight + 16} fill="#8d99ae" fontSize={11} fontWeight="500" textAnchor="middle">
                S{index + 1}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

