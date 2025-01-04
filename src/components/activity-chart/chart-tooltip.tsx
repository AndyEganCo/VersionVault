import { Card } from '@/components/ui/card';
import { TooltipProps } from 'recharts';
import { ChartDataPoint } from './types';

type CustomTooltipProps = TooltipProps<number, string> & {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
};

export function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  
  return (
    <Card className="p-2 border shadow-sm">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{data.date}</span>
        <span className="text-sm text-muted-foreground">
          {data.updates} updates
        </span>
      </div>
    </Card>
  );
}