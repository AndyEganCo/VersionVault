import { CartesianGrid } from 'recharts';

export function ChartGrid() {
  return (
    <CartesianGrid 
      strokeDasharray="3 3" 
      stroke="hsl(var(--border))"
      vertical={false}
    />
  );
}