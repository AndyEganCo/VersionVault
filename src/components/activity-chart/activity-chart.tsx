import { ErrorBoundary } from 'react-error-boundary';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { ActivityChartProps, ChartDataPoint } from './types';
import { ChartGradient } from './chart-components/gradient';
import { DataLine } from './chart-components/data-line';

type CustomTooltipProps = TooltipProps<number, string>;

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload as ChartDataPoint;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <p className="text-sm font-medium">{data.date}</p>
      <p className="text-sm text-muted-foreground">
        {data.updates} updates
      </p>
    </div>
  );
};

function ErrorFallback() {
  return (
    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
      Error loading chart
    </div>
  );
}

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
    <ErrorBoundary FallbackComponent={ErrorFallback}>
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
          <Tooltip content={CustomTooltip} />
          <DataLine />
        </LineChart>
      </ResponsiveContainer>
    </ErrorBoundary>
  );
}