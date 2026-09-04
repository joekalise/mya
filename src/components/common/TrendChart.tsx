import React from 'react';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { FontFamily } from '@/constants/theme';

interface TrendChartSeries {
  data: number[];
  color: string;
  label: string;
}

interface TrendChartProps {
  series: TrendChartSeries[];
  labels: string[];
  height: number;
  minVal?: number;
  maxVal?: number;
  width: number;
}

export function TrendChart({ series, labels, height, minVal = 0, maxVal = 10, width }: TrendChartProps) {
  const paddingLeft = 28;
  const paddingRight = 8;
  const paddingTop = 10;
  const paddingBottom = 24;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const pointCount = labels.length;

  function xForIndex(i: number): number {
    if (pointCount <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (i / (pointCount - 1)) * chartWidth;
  }

  function yForValue(value: number): number {
    const clamped = Math.min(maxVal, Math.max(minVal, value));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    return paddingTop + chartHeight - ratio * chartHeight;
  }

  function buildPoints(data: number[]): string {
    return data.map((v, i) => `${xForIndex(i).toFixed(1)},${yForValue(v).toFixed(1)}`).join(' ');
  }

  const ySteps = [minVal, (minVal + maxVal) / 2, maxVal];

  return (
    <Svg width={width} height={height}>
      {ySteps.map((val) => {
        const y = yForValue(val);
        return (
          <React.Fragment key={`y-${val}`}>
            <Line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="#E7E5E4" strokeWidth={1} strokeDasharray="3,3" />
            <SvgText x={paddingLeft - 4} y={y + 4} fontSize={9} fontFamily={FontFamily.regular} fill="#A8A29E" textAnchor="end">
              {val % 1 === 0 ? val.toString() : val.toFixed(0)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {labels.map((label, i) => {
        const step = Math.max(1, Math.ceil(pointCount / 7));
        if (i % step !== 0) return null;
        return (
          <SvgText key={`x-${i}`} x={xForIndex(i)} y={height - 4} fontSize={9} fontFamily={FontFamily.regular} fill="#A8A29E" textAnchor="middle">
            {label}
          </SvgText>
        );
      })}

      {series.map((s) => {
        if (s.data.length < 2) return null;
        return (
          <Polyline key={s.label} points={buildPoints(s.data)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        );
      })}

      {series.map((s) => {
        if (s.data.length === 0) return null;
        const lastIdx = s.data.length - 1;
        return <Circle key={`dot-${s.label}`} cx={xForIndex(lastIdx)} cy={yForValue(s.data[lastIdx])} r={4} fill={s.color} />;
      })}
    </Svg>
  );
}
