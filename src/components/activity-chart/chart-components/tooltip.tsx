import { Card } from '@/components/ui/card';
import { TooltipProps } from 'recharts';
import { ChartDataPoint } from '../types';

type ChartTooltipProps = TooltipProps<number, string> & {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
};

export function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <Card className="p-2 border shadow-sm">
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {payload[0].payload.date}
        </span>
        <span className="text-sm text-muted-foreground">
          {payload[0].value} updates
        </span>
      </div>
    </Card>
  );
}