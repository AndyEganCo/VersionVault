import { LineChart, ResponsiveContainer, Tooltip, Area } from 'recharts';
import { generateChartData } from '@/lib/chart';
import { ChartTooltip } from './charts/chart-tooltip';
import { ChartGrid } from './charts/chart-grid';
import { ChartAxes } from './charts/chart-axes';
import type { ChartDataPoint } from '@/lib/chart';

export function UpdateTrends() {
  const data = generateChartData();
  const maxUpdates = Math.max(...data.map(d => d.updates));
  const chartHeight = Math.max(350, maxUpdates * 50);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart 
        data={data}
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <ChartGrid />
        <ChartAxes />
        <Area
          type="monotone"
          dataKey="updates"
          stroke="hsl(var(--primary))"
          fill="url(#gradient)"
          strokeWidth={2}
          dot={{
            r: 4,
            fill: "hsl(var(--background))",
            strokeWidth: 2,
          }}
          activeDot={{
            r: 6,
            fill: "hsl(var(--background))",
            strokeWidth: 2,
          }}
        />
        <Tooltip content={ChartTooltip} />
      </LineChart>
    </ResponsiveContainer>
  );
}