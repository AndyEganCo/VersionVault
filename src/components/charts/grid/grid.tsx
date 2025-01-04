import { CartesianGrid } from 'recharts';

export function Grid() {
  return (
    <CartesianGrid 
      strokeDasharray="3 3" 
      vertical={false} 
      stroke="hsl(var(--border))"
    />
  );
}