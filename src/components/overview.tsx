import { LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { generateChartData } from '@/lib/chart';
import { ChartTooltip } from './charts/chart-tooltip';
import { ChartLine } from './charts/chart-line';
import { ChartGrid } from './charts/chart-grid';
import { ChartAxes } from './charts/chart-axes';

export function Overview() {
  const data = generateChartData();
  const maxUpdates = Math.max(...data.map(d => d.updates));

  // If there's no data or all values are 0, show a default height
  const chartHeight = maxUpdates === 0 ? 100 : 350;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart 
        data={data}
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <ChartGrid />
        <ChartAxes />
        <ChartLine maxUpdates={maxUpdates} />
        <Tooltip content={ChartTooltip} />
      </LineChart>
    </ResponsiveContainer>
  );
}