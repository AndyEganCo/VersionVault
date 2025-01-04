import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ActivityChartProps } from './types';
import { ChartTooltip } from './chart-components/tooltip';
import { ChartGradient } from './chart-components/gradient';
import { DataLine } from './chart-components/data-line';

export function ActivityChart({ data }: ActivityChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground">
        No update data available
      </div>
    );
  }

  const maxUpdates = Math.max(...data.map(d => d.updates));
  const yAxisTicks = Array.from(
    { length: 5 }, 
    (_, i) => Math.round((i * maxUpdates) / 4)
  );

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <ChartGradient />
        <CartesianGrid 
          strokeDasharray="3 3" 
          vertical={false} 
          stroke="hsl(var(--border))"
        />
        <XAxis 
          dataKey="date"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dx={-10}
          ticks={yAxisTicks}
        />
        <Tooltip content={ChartTooltip} />
        <DataLine />
      </LineChart>
    </ResponsiveContainer>
  );
}