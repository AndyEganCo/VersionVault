import { XAxis as RechartsXAxis } from 'recharts';

export function XAxis() {
  return (
    <RechartsXAxis 
      dataKey="date" 
      stroke="hsl(var(--muted-foreground))"
      fontSize={12}
      tickLine={false}
      axisLine={false}
      dy={10}
      interval="preserveStartEnd"
      scale="point"
      padding={{ left: 10, right: 10 }}
    />
  );
}